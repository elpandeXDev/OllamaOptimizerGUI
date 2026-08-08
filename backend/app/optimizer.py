"""Optimization engine: detects hardware/storage and computes optimal Ollama parameters.

This module analyzes the system's hardware (CPU, RAM, storage type) and recommends
optimal Ollama runtime parameters to maximize response speed and fluidity.
Works for both SSD and HDD configurations.
"""
import os
import psutil
import platform
import shutil
import logging
from dataclasses import dataclass, asdict
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class SystemInfo:
    cpu_count: int
    cpu_freq_mhz: float
    total_ram_gb: float
    available_ram_gb: float
    storage_type: str  # "SSD" or "HDD"
    os_name: str
    gpu_available: bool
    gpu_name: Optional[str]


@dataclass
class OptimizationProfile:
    num_ctx: int
    num_gpu: int
    num_thread: int
    keep_alive: str
    num_batch: int
    num_predict: int
    f16_kv: bool
    use_mmap: bool
    use_mlock: bool
    low_vram: bool
    description: str


def _detect_storage_type() -> str:
    """Detect if the primary storage is SSD or HDD.

    On Linux, reads /sys/block rotational flag.
    On Windows, uses wmic.
    Fallback: assume SSD (safe default for mmap).
    """
    system = platform.system()

    if system == "Linux":
        try:
            for device in os.listdir("/sys/block"):
                if device.startswith(("sd", "nvme", "vd")):
                    rotational_path = f"/sys/block/{device}/queue/rotational"
                    if os.path.exists(rotational_path):
                        with open(rotational_path) as f:
                            val = f.read().strip()
                        if val == "0":
                            return "SSD"
                        elif val == "1":
                            return "HDD"
        except Exception as e:
            logger.warning(f"Linux storage detection failed: {e}")

    elif system == "Windows":
        try:
            import subprocess
            result = subprocess.run(
                ["wmic", "diskdrive", "get", "MediaType"],
                capture_output=True, text=True, timeout=10
            )
            output = result.stdout.lower()
            if "hdd" in output or "fixed hard disk" in output:
                if "ssd" not in output:
                    return "HDD"
            if "ssd" in output or "solid state" in output:
                return "SSD"
        except Exception as e:
            logger.warning(f"Windows storage detection failed: {e}")

    elif system == "Darwin":
        # macOS almost always uses SSD
        return "SSD"

    # Fallback: check if /tmp or working dir is on SSD by speed test
    return "SSD"


def _detect_gpu() -> tuple[bool, Optional[str]]:
    """Detect if a GPU is available for Ollama acceleration."""
    system = platform.system()

    if system == "Linux":
        try:
            if os.path.exists("/dev/nvidia0"):
                return True, "NVIDIA GPU"
            if os.path.exists("/dev/kfd") or os.path.exists("/dev/dri"):
                return True, "AMD/Intel GPU"
        except Exception:
            pass

    elif system == "Windows":
        try:
            import subprocess
            result = subprocess.run(
                ["wmic", "path", "videocontroller", "get", "name"],
                capture_output=True, text=True, timeout=10
            )
            output = result.stdout.lower()
            if "nvidia" in output:
                return True, "NVIDIA GPU"
            if "amd" in output or "radeon" in output:
                return True, "AMD GPU"
        except Exception:
            pass

    return False, None


def get_system_info() -> SystemInfo:
    """Gather system hardware information."""
    vm = psutil.virtual_memory()
    cpu_freq = psutil.cpu_freq()

    gpu_available, gpu_name = _detect_gpu()

    return SystemInfo(
        cpu_count=psutil.cpu_count(logical=True) or 4,
        cpu_freq_mhz=cpu_freq.current if cpu_freq else 0,
        total_ram_gb=round(vm.total / (1024**3), 2),
        available_ram_gb=round(vm.available / (1024**3), 2),
        storage_type=_detect_storage_type(),
        os_name=platform.system(),
        gpu_available=gpu_available,
        gpu_name=gpu_name,
    )


def compute_optimization(
    system_info: SystemInfo,
    model_size_gb: float = 4.0,
    quality_mode: str = "balanced",
) -> OptimizationProfile:
    """Compute optimal Ollama parameters based on hardware and model size.

    Args:
        system_info: System hardware info.
        model_size_gb: Approximate model file size in GB.
        quality_mode: "speed", "balanced", or "quality".

    Returns:
        OptimizationProfile with recommended parameters.
    """
    is_ssd = system_info.storage_type == "SSD"
    has_gpu = system_info.gpu_available
    available_ram = system_info.available_ram_gb
    total_ram = system_info.total_ram_gb

    # Estimate parameter count from file size (Q4_K_M ~0.65GB per B params)
    approx_params_b = model_size_gb / 0.65

    # RAM needed: model + KV cache + overhead (~1.5x model size)
    ram_needed = model_size_gb * 1.5
    fits_in_ram = available_ram >= ram_needed

    # Base context size by quality mode
    ctx_map = {"speed": 2048, "balanced": 4096, "quality": 8192}
    num_ctx = ctx_map.get(quality_mode, 4096)

    # Adjust context based on RAM and model size
    # Larger models need more RAM for KV cache, so reduce context if tight
    if not fits_in_ram:
        num_ctx = min(num_ctx, 2048)
    elif available_ram < 8:
        num_ctx = min(num_ctx, 2048)
    elif available_ram < 16:
        num_ctx = min(num_ctx, 4096)
    elif model_size_gb > 9 and quality_mode == "quality":
        # 14B+ models in quality mode need more RAM for context
        if available_ram < 20:
            num_ctx = min(num_ctx, 6144)

    # Batch size: larger for SSD, smaller for HDD
    # For big models (7B+), increase batch on SSD for better throughput
    if is_ssd:
        if model_size_gb >= 7:
            num_batch = 512
        else:
            num_batch = 512
    else:
        num_batch = 256  # HDD: smaller batches to reduce I/O stalls

    # Threads: use physical cores, cap at 8 for efficiency
    # For 7B+ models, use more threads if available
    physical_cores = system_info.cpu_count
    if physical_cores > 16:
        num_thread = min(physical_cores // 2, 8)
    elif physical_cores > 8:
        num_thread = physical_cores // 2
    elif physical_cores > 4:
        num_thread = physical_cores - 1
    else:
        num_thread = max(physical_cores - 1, 1)

    # GPU layers
    if has_gpu:
        if available_ram < 4 or model_size_gb > available_ram:
            num_gpu = 20  # Partial offload for low VRAM
            low_vram = True
        else:
            num_gpu = 99  # Full offload
            low_vram = False
    else:
        num_gpu = 0
        low_vram = False

    # Keep alive: shorter for HDD, longer for SSD
    # For big models (10GB+), keep longer to avoid reloading
    # For 14GB+ (24B), keep even longer since reload is expensive
    if is_ssd:
        if model_size_gb >= 14:
            keep_alive = "45m"
        elif model_size_gb >= 10:
            keep_alive = "30m"
        else:
            keep_alive = "10m"
    else:
        if model_size_gb >= 14:
            keep_alive = "20m"
        elif model_size_gb >= 10:
            keep_alive = "15m"
        else:
            keep_alive = "5m"

    # mmap: always enable; mlock only if RAM is sufficient
    use_mmap = True
    use_mlock = is_ssd and available_ram > model_size_gb * 1.5

    # f16_kv: disable for speed mode to save memory
    # For 14B+ on CPU, disable f16_kv if RAM is tight to save memory
    if model_size_gb > 9 and available_ram < ram_needed * 1.3:
        f16_kv = False
    else:
        f16_kv = quality_mode != "speed"

    # num_predict: limit for speed mode
    num_predict = -1 if quality_mode == "quality" else (512 if quality_mode == "speed" else -1)

    # Build description with model size awareness
    size_label = f"{approx_params_b:.0f}B" if approx_params_b >= 1 else f"{model_size_gb}GB"
    base_desc = {
        "speed": f"Modo velocidad — {size_label}: respuestas rápidas, contexto reducido, máxima fluidez.",
        "balanced": f"Modo equilibrado — {size_label}: combina velocidad y calidad para uso general.",
        "quality": f"Modo calidad — {size_label}: contexto amplio, máxima precisión para tareas complejas.",
    }
    description = base_desc.get(quality_mode, base_desc["balanced"])

    if not fits_in_ram:
        description += f" ⚠️ El modelo necesita ~{ram_needed:.1f}GB RAM pero solo hay {available_ram:.1f}GB libres. Se usará swap (más lento)."

    return OptimizationProfile(
        num_ctx=num_ctx,
        num_gpu=num_gpu,
        num_thread=num_thread,
        keep_alive=keep_alive,
        num_batch=num_batch,
        num_predict=num_predict,
        f16_kv=f16_kv,
        use_mmap=use_mmap,
        use_mlock=use_mlock,
        low_vram=low_vram,
        description=description,
    )


def profile_to_options(profile: OptimizationProfile) -> dict:
    """Convert OptimizationProfile to Ollama API options dict."""
    return {
        "num_ctx": profile.num_ctx,
        "num_gpu": profile.num_gpu,
        "num_thread": profile.num_thread,
        "num_batch": profile.num_batch,
        "num_predict": profile.num_predict,
        "f16_kv": profile.f16_kv,
        "use_mmap": profile.use_mmap,
        "use_mlock": profile.use_mlock,
        "low_vram": profile.low_vram,
    }


def system_info_dict(info: SystemInfo) -> dict:
    return asdict(info)


def optimization_dict(profile: OptimizationProfile) -> dict:
    return asdict(profile)

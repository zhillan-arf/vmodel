"""Provision a separate hash-locked ONNX/DirectML probe environment."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
PYTHON = ROOT / '.tools/voice/onnx-venv/Scripts/python.exe'


def main():
    if not PYTHON.exists():
        subprocess.run(['uv', 'venv', '--python', '3.10.19', str(PYTHON.parents[1])], cwd=ROOT, check=True)
    subprocess.run(['uv', 'pip', 'sync', '--python', str(PYTHON), '--require-hashes',
                    'config/voice/requirements-onnx.lock'], cwd=ROOT, check=True)
    subprocess.run(['uv', 'pip', 'check', '--python', str(PYTHON)], cwd=ROOT, check=True)
    # Record actual installed distributions and retained native notices; the
    # DirectML redistributable is a Windows platform component, not MIT code.
    subprocess.run([str(PYTHON), '-I', str(ROOT / 'scripts/voice/record_onnx_environment.py')],
                   cwd=ROOT, check=True)


if __name__ == '__main__':
    main()

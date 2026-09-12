"""Shared setup for background Blender scripts; isolated project add-ons."""
from pathlib import Path
import shutil
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def setup():
    import addon_utils
    import bpy
    addons = ROOT / '.tools' / 'blender' / 'addons'
    addons.mkdir(parents=True, exist_ok=True)
    for source, name in [(ROOT / '.tools/mmd', 'mmd_tools'),
                         (ROOT / '.tools/vrm/VRM_Addon_for_Blender-release', 'io_scene_vrm')]:
        target = addons / name
        if not (target / '__init__.py').exists():
            shutil.copytree(source, target, dirs_exist_ok=True)
    sys.path.insert(0, str(addons))
    dependencies = ROOT / '.tools' / 'blender' / 'python'
    dependencies.mkdir(exist_ok=True)
    for wheel in (ROOT / '.tools/mmd/wheels').glob('*.whl'):
        if not (dependencies / (wheel.name + '.installed')).exists():
            with zipfile.ZipFile(wheel) as archive:
                archive.extractall(dependencies)
            (dependencies / (wheel.name + '.installed')).touch()
    sys.path.insert(0, str(dependencies))
    for name in ('mmd_tools', 'io_scene_vrm'):
        module = addon_utils.enable(name, default_set=True, persistent=False)
        if module is None:
            raise RuntimeError(f'Failed to enable {name}')
    print('VMODEL_ADDONS_READY', bpy.app.version_string, flush=True)

if __name__ == '__main__':
    setup()

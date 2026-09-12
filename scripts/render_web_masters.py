"""Render accepted RGBA masters; interrupted runs resume verified cached frames.

Blender --python scripts/render_web_masters.py -- [--spike] [resource ...]
Create assets/work/ene-web/production.pause to stop after the current frame.
Remove that file and rerun the same command to resume without mixing sources.
"""
from pathlib import Path
import sys
import time
sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_bootstrap import setup
from web_production import ROOT, IDS, WORK, PAUSE, SETTINGS, plan, read_json, write_json, relative, png_info
setup()
import bpy

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
spike = '--spike' in args
selected = [arg for arg in args if arg != '--spike'] or (list(IDS[:2]) if spike else list(IDS))
if bpy.app.version_string != '5.1.1' or bpy.app.build_hash.decode() != 'b70da489d7f4':
    raise RuntimeError('Blender version differs from accepted render recipe')
run_started = time.perf_counter()
run = {'mode': 'timing-spike' if spike else 'production', 'state': 'running', 'resources': [], 'framesRendered': 0,
       'pauseFile': relative(PAUSE), 'cpuThreads': 4}
run_path = ROOT / ('ops/reports/web-production-timing.json' if spike else 'ops/reports/web-production-render.json')
write_json(run_path, run)
for resource in selected:
    recipe = plan(resource)
    folder = ROOT / recipe['masterDirectory']
    folder.mkdir(parents=True, exist_ok=True)
    index_path = folder / 'index.json'
    index = read_json(index_path) if index_path.exists() else {**recipe, 'state': 'pending', 'frames': {}}
    if index['buildKey'] != recipe['buildKey']:
        raise RuntimeError('Master cache recipe mismatch')
    frames = [1, 61 if resource == 'home-greeting' else 37] if spike else range(1, recipe['frameCount'] + 1)
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / recipe['scene']))
    scene = bpy.context.scene
    scene.render.engine = SETTINGS['engine']
    scene.eevee.taa_render_samples = 32
    scene.render.resolution_x, scene.render.resolution_y = recipe['size']
    scene.render.resolution_percentage = 100
    scene.render.fps, scene.render.fps_base = 24, 1
    scene.render.threads_mode, scene.render.threads = 'FIXED', 4
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 20
    scene.render.film_transparent = True
    scene.render.use_persistent_data = True
    scene.view_settings.view_transform, scene.view_settings.look = 'Standard', 'None'
    scene.view_settings.exposure, scene.view_settings.gamma = -0.2, 1
    index['actualCamera'] = {'location': list(scene.camera.location), 'rotationEuler': list(scene.camera.rotation_euler),
                             'type': scene.camera.data.type, 'orthoScale': scene.camera.data.ortho_scale}
    index['determinism'] = 'Fixed accepted scene/action keys, version, camera, settings and frame recipe; cross-driver pixel identity is not claimed.'
    index['state'] = 'rendering'
    for frame in frames:
        if PAUSE.exists():
            index['state'] = 'paused'
            write_json(index_path, index)
            run.update(state='paused', elapsedSeconds=time.perf_counter() - run_started)
            write_json(run_path, run)
            print('PRODUCTION_PAUSED', resource, frame, flush=True)
            sys.exit(0)
        path = folder / f'frame-{frame:04d}.png'
        cached = index['frames'].get(str(frame))
        if path.exists() and cached:
            try:
                info = png_info(path, recipe['size'])
                if info['sha256'] == cached['sha256']:
                    print('MASTER_CACHED', resource, frame, flush=True)
                    continue
            except (ValueError, OSError):
                pass
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        scene.render.filepath = str(path)
        started = time.perf_counter()
        bpy.ops.render.render(write_still=True)
        seconds = time.perf_counter() - started
        info = png_info(path, recipe['size'])
        index['frames'][str(frame)] = {'sourceFrame': frame, 'file': relative(path), 'renderSeconds': seconds, **info}
        write_json(index_path, index)
        run['framesRendered'] += 1
        run['lastFrame'] = {'resource': resource, 'frame': frame, 'seconds': seconds}
        run['elapsedSeconds'] = time.perf_counter() - run_started
        write_json(run_path, run)
        print('MASTER_FRAME', resource, frame, round(seconds, 3), info['bytes'], flush=True)
    index['state'] = 'complete' if len(index['frames']) == recipe['frameCount'] else 'partial'
    write_json(index_path, index)
    run['resources'].append({'resource': resource, 'index': relative(index_path), 'cachedFrames': len(index['frames']),
                             'frameCount': recipe['frameCount'], 'state': index['state'],
                             'frameRenderSeconds': [record['renderSeconds'] for record in index['frames'].values()]})
run.update(state='complete', elapsedSeconds=time.perf_counter() - run_started)
write_json(run_path, run)
print('PRODUCTION_RUN_COMPLETE', run['mode'], run['framesRendered'], round(run['elapsedSeconds'], 2), flush=True)

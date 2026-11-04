"""Build the same C++ source for WebAssembly and the native benchmark CLI.

Set ZIG to a Zig executable, or install ziglang with pip and use --zig.
The published WASM file is checked in; rebuilding is optional for viewing.
"""
import argparse
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--zig', default=os.environ.get('ZIG') or shutil.which('zig'))
    args = parser.parse_args()
    if not args.zig:
        parser.error('Informe --zig /caminho/para/zig ou defina ZIG. Consulte o README.')
    common = [args.zig, 'cc', '-x', 'c++', '-O3', '-fno-exceptions', '-fno-rtti']
    subprocess.run(common + ['-target', 'wasm32-freestanding', '-nostdlib', '-Wl,--no-entry', '-Wl,--export=optimize', '-Wl,--export=get_input_ptr', '-Wl,--export=get_output_ptr', '-Wl,--export-memory', 'engine/optimizer.cpp', '-o', 'dist/optimizer.wasm'], cwd=ROOT, check=True)
    suffix = '.exe' if os.name == 'nt' else ''
    subprocess.run(common + ['-DROTALAB_NATIVE', 'engine/optimizer.cpp', '-o', 'engine/optimizer' + suffix], cwd=ROOT, check=True)
    print('Motor WebAssembly e executável nativo compilados.')

if __name__ == '__main__':
    main()

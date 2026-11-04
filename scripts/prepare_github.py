"""Create a clean source bundle without hosting metadata or Git history.

Usage: python scripts/prepare_github.py --output ../github-preparado/rotalab
The destination must not exist. No repository is created or pushed remotely.
"""
import argparse
from pathlib import Path
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIES = ('dist', 'tests', 'scripts', 'experiments', 'docs', '.github')
FILES = ('README.md', 'DESIGN.md', 'CHANGELOG.md', 'package.json',
         '.gitignore', '.gitattributes', '.editorconfig')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    destination = args.output.resolve()
    archive = destination.with_name(destination.name + '-github.zip')
    if destination.exists() or archive.exists():
        parser.error('Destino ou ZIP já existe; escolha outro caminho para preservar os arquivos.')
    if destination == ROOT or ROOT in destination.parents:
        parser.error('Use uma pasta fora do checkout do RotaLab.')
    destination.mkdir(parents=True)
    for directory in DIRECTORIES:
        shutil.copytree(ROOT / directory, destination / directory,
                        ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '*.tmp'))
    (destination / 'engine').mkdir()
    shutil.copy2(ROOT / 'engine/optimizer.cpp', destination / 'engine/optimizer.cpp')
    for filename in FILES:
        shutil.copy2(ROOT / filename, destination / filename)
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for file in sorted(destination.rglob('*')):
            if file.is_file():
                bundle.write(file, Path('rotalab') / file.relative_to(destination))
    print(f'Fonte: {destination}')
    print(f'Pacote: {archive}')


if __name__ == '__main__':
    main()

import asyncio
import os
import sys

from workbench_backend.docker.build_utils import build_image

BASE_WORKBENCH_IMAGE_ROOT = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        'images',
        'base-workbench-image'
    )
)

INCONTAINER_EDITOR_IMAGE_ROOT = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        'images',
        'incontainer-editor'
    )
)

async def amain() -> None:
    try:
        await build_image(
            BASE_WORKBENCH_IMAGE_ROOT,
            'base-workbench',
            buildargs={
                'GITHUB_TOKEN':os.environ.get('GITHUB_TOKEN')
            },
            stream_callback=lambda e: print(e)
        )
    except Exception as e:
        print("Failed to build base-workbench image",e)
        sys.exit(1)

    try:
        await build_image(
            INCONTAINER_EDITOR_IMAGE_ROOT,
            'editor-container',
            stream_callback=lambda e: print(e)
        )
    except Exception as e:
        print("Failed to build editor-container image",e)
        sys.exit(1)


def main() -> None:
    asyncio.run(amain())


if __name__ == '__main__':
    main()

import logging
import os
from functools import lru_cache
from io import BytesIO

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from PIL import Image
from PIL.ImageSequence import Iterator

logger = logging.getLogger(__name__)
MAX_PHOTO_BYTES = 5 * 1024 * 1024
MAX_DECODED_PIXELS = 25_000_000
FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}


def image_content_type(data: bytes) -> str:
    """Check the actual image and decode it before publishing the original bytes."""
    try:
        with Image.open(BytesIO(data), formats=list(FORMATS)) as image:
            content_type = FORMATS[image.format]  # type: ignore
            if image.width * image.height > MAX_DECODED_PIXELS:
                raise ValueError
            image.verify()
        with Image.open(BytesIO(data), formats=list(FORMATS)) as image:
            remaining_pixels = MAX_DECODED_PIXELS
            for frame in Iterator(image):
                remaining_pixels -= frame.width * frame.height
                if remaining_pixels < 0:
                    raise ValueError
                frame.load()
    except (OSError, SyntaxError, EOFError, ValueError, Image.DecompressionBombError):
        raise ValueError(
            "Choose a valid JPEG, PNG or WebP under 25 million decoded pixels."
        ) from None
    return content_type


def bucket() -> str:
    return os.environ["S3_PHOTO_BUCKET"]


@lru_cache
def s3_client(endpoint: str | None):
    return boto3.session.Session().client(  # type: ignore
        "s3",
        endpoint_url=endpoint,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"} if endpoint else None,
            connect_timeout=2,
            read_timeout=5,
            retries={"total_max_attempts": 2},
        ),
    )


def put_photo(key: str, data: bytes, content_type: str) -> None:
    s3_client(os.getenv("S3_ENDPOINT_URL")).put_object(
        Bucket=bucket(),
        Key=key,
        Body=data,
        ContentType=content_type,
    )


def photo_url(key: str) -> str:
    # Sign for the browser's hostname; changing it after signing invalidates SigV4.
    endpoint = os.getenv("S3_PUBLIC_ENDPOINT_URL") or os.getenv("S3_ENDPOINT_URL")
    return s3_client(endpoint).generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket(), "Key": key},
        ExpiresIn=300,
    )


def delete_photo(key: str) -> None:
    try:
        s3_client(os.getenv("S3_ENDPOINT_URL")).delete_object(Bucket=bucket(), Key=key)
    except (BotoCoreError, ClientError, KeyError):
        logger.exception("Could not clean up cover object %s", key)


def ensure_local_bucket() -> None:
    endpoint = os.environ["S3_ENDPOINT_URL"]
    client = s3_client(endpoint)
    try:
        client.head_bucket(Bucket=bucket())
    except ClientError as error:
        if error.response["ResponseMetadata"]["HTTPStatusCode"] != 404:
            raise
        client.create_bucket(Bucket=bucket())


if __name__ == "__main__":
    ensure_local_bucket()

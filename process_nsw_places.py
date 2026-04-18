"""Filter the Foursquare Open Source Places dataset down to New South Wales.

This script reads a directory of Parquet files, filters rows to an NSW bounding
box, keeps only the requested columns, and writes a single CSV file for easy
upload into Supabase PostGIS or other downstream tools.
"""

from __future__ import annotations

import argparse
import shutil
import tempfile
from pathlib import Path

from pyspark.sql import SparkSession
from pyspark.sql.functions import col


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Filter Foursquare places to NSW and export a single CSV file."
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Input Parquet directory or glob, for example places/parquet/*.parquet",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output CSV file path, for example output/nsw_places.csv",
    )
    return parser.parse_args()


def build_spark_session() -> SparkSession:
    return (
        SparkSession.builder.appName("FoursquarePlacesNSWExport")
        # Efficient Parquet reads for large datasets.
        .config("spark.sql.parquet.enableVectorizedReader", "true")
        .config("spark.sql.parquet.mergeSchema", "false")
        .config("spark.sql.adaptive.enabled", "true")
        .config("spark.sql.shuffle.partitions", "200")
        .getOrCreate()
    )


def main() -> None:
    args = parse_args()
    spark = build_spark_session()
    output_path = Path(args.output)

    try:
        df = spark.read.parquet(args.input)

        nsw_df = (
            df.filter(col("latitude").isNotNull() & col("longitude").isNotNull())
            .filter(col("longitude").between(141.0, 154.0))
            .filter(col("latitude").between(-37.5, -28.0))
            .select(
                "fsq_place_id",
                "name",
                "latitude",
                "longitude",
                "level1_category_name",
                "level2_category_name",
            )
        )

        # Spark writes CSV output as a directory, so write to a temp directory first
        # and then move the single part file to the requested .csv path.
        with tempfile.TemporaryDirectory() as temp_dir:
            nsw_df.coalesce(1).write.mode("overwrite").option("header", "true").csv(
                temp_dir
            )

            part_files = sorted(Path(temp_dir).glob("part-*.csv"))
            if not part_files:
                raise RuntimeError("No CSV part file was produced by Spark.")

            output_path.parent.mkdir(parents=True, exist_ok=True)
            if output_path.exists():
                output_path.unlink()
            shutil.move(str(part_files[0]), str(output_path))
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
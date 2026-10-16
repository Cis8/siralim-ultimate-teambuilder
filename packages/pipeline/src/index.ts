import { DATASET_SCHEMA_VERSION } from '@atlas/core';

/** The schema version the pipeline writes; always the one `core` defines, so writer and reader cannot drift. */
export const emittedSchemaVersion = DATASET_SCHEMA_VERSION;

import { z } from "zod";

// Shared EVM address validation: wizard input and share-link URL params.
export const ethAddressSchema = z
  .string()
  .length(42, {
    error: "Must be exactly 42 characters long including leading '0x'",
  })
  .regex(/^0x[0-9a-fA-F]*$/, {
    error: "Must contain only hexadecimal characters",
  });

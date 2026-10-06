import { z } from 'zod';

import { FEE_PERCENT_MAX } from '../domain/fee-terms';

import { CaseFormShape } from './case.schema';

const FeePercentSchema = z.preprocess(
  (v) => {
    if (v === '' || v === null || v === undefined) return null;
    return typeof v === 'number' ? v : Number(v);
  },
  z
    .number({ error: 'common.errors.invalidNumber' })
    .gt(0, { error: 'common.errors.tooSmall' })
    .max(FEE_PERCENT_MAX, { error: 'common.errors.tooLarge' })
    .nullable(),
);

/**
 * The מנהלה fee field's input: a value in the chosen basis. `value: null`
 * clears the fee (sum and percentage both). The sum reuses the case form's
 * money validator so both entry points accept the same amounts.
 */
export const CaseFeeTermsSchema = z.discriminatedUnion('basis', [
  z.object({ basis: z.literal('fixed'), value: CaseFormShape.shape.fee_amount }),
  z.object({ basis: z.literal('percent'), value: FeePercentSchema }),
]);

export type CaseFeeTermsInput = z.input<typeof CaseFeeTermsSchema>;

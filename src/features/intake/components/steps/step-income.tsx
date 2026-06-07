'use client';

import { BorrowerIncomeFields } from '../borrower-income-fields';

import type { BorrowerDraft, SetBorrower } from '../../form-state';
import type { IntakeFieldErrors } from '../../types';

type Props = {
  borrowers: BorrowerDraft[];
  errors: IntakeFieldErrors;
  onChange: SetBorrower;
};

export function StepIncome({ borrowers, errors, onChange }: Props) {
  return (
    <div className="space-y-8">
      {borrowers.map((b, i) => (
        <BorrowerIncomeFields key={i} index={i} borrower={b} errors={errors} onChange={onChange} />
      ))}
    </div>
  );
}

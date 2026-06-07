'use client';

import { BorrowerPersonalFields } from '../borrower-personal-fields';

import type { BorrowerDraft, SetBorrower } from '../../form-state';
import type { IntakeFieldErrors } from '../../types';

type Props = {
  borrowers: BorrowerDraft[];
  errors: IntakeFieldErrors;
  onChange: SetBorrower;
};

export function StepPersonal({ borrowers, errors, onChange }: Props) {
  return (
    <div className="space-y-8">
      {borrowers.map((b, i) => (
        <BorrowerPersonalFields key={i} index={i} borrower={b} errors={errors} onChange={onChange} />
      ))}
    </div>
  );
}

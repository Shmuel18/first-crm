'use client';

import { BorrowerPersonalFields } from '../borrower-personal-fields';

import type { BorrowerDraft, SetBorrower, SetBorrowerPatch } from '../../form-state';
import type { IntakeFieldErrors } from '../../types';

type Props = {
  borrowers: BorrowerDraft[];
  errors: IntakeFieldErrors;
  onChange: SetBorrower;
  onPatch: SetBorrowerPatch;
};

export function StepPersonal({ borrowers, errors, onChange, onPatch }: Props) {
  return (
    <div className="space-y-8">
      {borrowers.map((b, i) => (
        <BorrowerPersonalFields
          key={i}
          index={i}
          borrower={b}
          errors={errors}
          onChange={onChange}
          primary={borrowers[0] ?? b}
          onPatch={onPatch}
        />
      ))}
    </div>
  );
}

import { redirect } from 'next/navigation';

// The standalone simulator hub is redundant with the tool tabs shown on every
// tool screen — land straight on the mix tool (mirrors the in-case hub).
export default function SimulatorsPage() {
  redirect('/simulators/mix');
}

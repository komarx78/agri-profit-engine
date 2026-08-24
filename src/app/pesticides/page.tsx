import { redirect } from 'next/navigation';

export default function PesticidesRedirect() {
  redirect('/farm/pesticide-check');
}

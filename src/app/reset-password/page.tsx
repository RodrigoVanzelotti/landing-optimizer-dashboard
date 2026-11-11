import type { Metadata } from 'next';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = { title: 'Redefinir senha | Landing Optimizer', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function ResetPasswordPage(): React.ReactElement {
  return <main lang="pt-BR" className="flex min-h-screen items-center justify-center bg-muted/40 p-5">
    <section className="w-full max-w-md rounded-2xl bg-card p-7 shadow-[0_16px_60px_-20px_rgba(15,23,42,0.2)] sm:p-10">
      <p className="mb-8 text-lg font-semibold">Landing<span className="text-primary">Optimizer</span></p>
      <h1 className="text-3xl font-semibold tracking-tight">Uma nova senha para seu acesso</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Escolha uma senha com pelo menos 10 caracteres. Ao concluir, todas as sessões anteriores da sua conta serão encerradas.</p>
      <ResetPasswordForm />
    </section>
  </main>;
}

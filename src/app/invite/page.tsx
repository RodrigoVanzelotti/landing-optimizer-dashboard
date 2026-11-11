import type { Metadata } from 'next';
import Link from 'next/link';
import { InvitationSchema } from '@/lib/invitation';
import { InvitationForm } from './invitation-form';

export const metadata: Metadata = {
  title: 'Seu convite | Landing Optimizer',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function InvitePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
  const invitation = InvitationSchema.safeParse(await searchParams);

  return (
    <main lang="pt-BR" className="min-h-screen bg-muted/40 p-5 selection:bg-primary/15 sm:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 py-3">
          <Link href="/login" className="text-lg font-semibold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            Landing<span className="text-primary">Optimizer</span>
          </Link>
          <span className="text-sm text-muted-foreground">Um novo olhar para sua landing page.</span>
        </header>
        {invitation.success ? (
          <div className="my-8 grid overflow-hidden rounded-2xl bg-card shadow-[0_20px_70px_-25px_rgba(15,23,42,0.18)] md:my-16 md:grid-cols-2">
            <section className="flex flex-col justify-between gap-12 bg-primary/5 p-7 sm:p-12">
              <div>
                <h1 className="break-words text-4xl font-semibold leading-tight tracking-tight [text-wrap:balance] sm:text-5xl">
                  {invitation.data.name},<br />seu próximo capítulo começa aqui.
                </h1>
                <p className="mt-6 max-w-md text-base leading-relaxed text-slate-600">
                  Este é o seu convite para o Landing Optimizer. Um espaço para entender seus visitantes e transformar descobertas em páginas melhores.
                </p>
              </div>
              <div className="border-t border-primary/15 pt-7">
                <p className="text-sm text-slate-600">Preparado para</p>
                <p className="mt-1 break-words font-medium">{invitation.data.name}</p>
                <p className="mt-1 break-all text-sm text-slate-600">{invitation.data.email}</p>
              </div>
            </section>
            <section className="p-7 sm:p-12" aria-labelledby="registration-title">
              <h2 id="registration-title" className="text-2xl font-semibold tracking-tight">Vamos preparar seu acesso</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Você vai entrar no workspace que convidou você. Crie sua senha para acessar pela primeira vez.</p>
              <InvitationForm name={invitation.data.name} email={invitation.data.email} />
            </section>
          </div>
        ) : (
          <section className="mx-auto my-20 max-w-lg rounded-2xl bg-card p-8 shadow-lg">
            <h1 className="text-2xl font-semibold">Precisamos do seu convite completo</h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">Este link está incompleto ou inválido. Peça à pessoa que convidou você um novo link com seu nome e e-mail.</p>
            <Link href="/login" className="mt-6 inline-block font-medium text-primary underline underline-offset-4">Já tenho conta</Link>
          </section>
        )}
        <footer className="text-center text-xs leading-relaxed text-muted-foreground">Landing Optimizer · Um espaço para experimentar, aprender e evoluir.</footer>
      </div>
    </main>
  );
}

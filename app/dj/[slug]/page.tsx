"use client";

import { use, useEffect, useState } from "react";
import { Checkout } from "@/components/checkout";
import { apiFetch } from "@/lib/client-api";

type Dj = { id: number; name: string; slug: string; quota: number; remaining: number };

export default function DjPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [dj, setDj] = useState<Dj | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/dj/${slug}`)
      .then((r) => r.json())
      .then((d) => { if (d.dj) setDj(d.dj); else setError(d.error ?? "Link não encontrado."); })
      .catch(() => setError("Não foi possível carregar este link agora. Tente novamente."));
  }, [slug]);

  if (error) return <main className="admin-page"><p className="kicker">PVT ALQUIMISTA</p><h1>Link indisponível</h1><p>{error}</p></main>;
  if (!dj) return <main className="admin-page"><p className="kicker">PVT ALQUIMISTA</p><h1>Carregando…</h1></main>;

  const soldOut = dj.remaining <= 0;

  return <main className="dj-page">
    <section className="dj-hero">
      <p className="kicker">PVT ALQUIMISTA · LUA CHEIA · AREMBEPE</p>
      <h1>Ingressos com <em>{dj.name}</em></h1>
      <p className="dj-sub">26/09 · 22h → 27/09 · 12h · Dunas Mar · Aldeia Hippie</p>
      <p className={soldOut ? "dj-quota esgotado" : "dj-quota"}>
        {soldOut ? "Este link atingiu o limite de ingressos." : `Restam ${dj.remaining} de ${dj.quota} ingressos neste link`}
      </p>
    </section>
    <section className="dj-body">
      <p className="checkout-ticket">Cada DJ tem um limite total de {dj.quota} ingressos, somando os vendidos por este link e as cortesias que ele distribuir.</p>
      {soldOut
        ? <p className="fineprint">Fale com a produção para mais informações.</p>
        : <Checkout djSlug={dj.slug} />}
      <p className="fineprint">Compra pelo link de {dj.name}. A produção identifica automaticamente que esta venda veio dele.</p>
    </section>
  </main>;
}

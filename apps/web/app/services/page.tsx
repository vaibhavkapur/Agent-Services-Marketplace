import { api, formatUsd } from "@/lib/api";

type Service = {
  service_id: string;
  description: string;
  capability: string;
  payment_profiles: string[];
  advertised_price: { amount_atomic: string; asset: string };
  data_provenance: string;
  usage_restrictions: string;
};

export default async function ServicesPage() {
  const services = await api<Service[]>("/v1/services");
  return (
    <main>
      <h1 className="text-3xl font-semibold">Service catalog</h1>
      <p className="mt-2 max-w-2xl text-slate-400">
        Catalog prices are advisory. The coordinator validates the live payment challenge before the isolated signer creates a credential.
      </p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {services.map((service) => (
          <article key={service.service_id} className="rounded-3xl border border-line bg-panel p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-mint">{service.capability}</div>
            <h2 className="mt-2 text-xl font-semibold">{service.service_id}</h2>
            <p className="mt-3 text-sm text-slate-300">{service.description}</p>
            <p className="mt-4 font-mono text-gold">
              {formatUsd(service.advertised_price.amount_atomic)} {service.advertised_price.asset}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {service.payment_profiles.map((profile) => (
                <span key={profile} className="rounded-full border border-line px-3 py-1 text-xs">
                  {profile}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">{service.data_provenance}</p>
          </article>
        ))}
      </div>
    </main>
  );
}

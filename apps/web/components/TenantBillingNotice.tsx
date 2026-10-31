type Props={agencyName?:string; level:"limited"|"suspended"};
/**
 * Neutral public notice for account-level billing restriction.
 * No debt or payment information is exposed to visitors.
 * This component never deletes tenant content.
 */
export default function TenantBillingNotice({agencyName,level}:Props){
  const limited=level==="limited";
  return <main className="tenantUnavailable"><div className="tenantUnavailableCard">
    <span className="eyebrow">{agencyName||"IMOBILIÁRIA"}</span>
    <h1>{limited?"Informações temporariamente limitadas":"Site temporariamente indisponível"}</h1>
    <p>{limited
      ?"A apresentação desta imobiliária está disponível. O catálogo detalhado e os canais de negociação estão temporariamente indisponíveis."
      :"Este site está temporariamente indisponível. Volte em breve."}</p>
    <small>Os dados da imobiliária permanecem preservados.</small>
  </div></main>;
}

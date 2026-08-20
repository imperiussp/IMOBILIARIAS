const highlights = [
  "Venda e locação",
  "Residencial e comercial",
  "Urbano e rural",
  "Contato direto com o corretor",
];

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container">
          <span className="eyebrow">IMOBILIARIAS</span>
          <h1>Encontre o imóvel certo para o seu próximo passo.</h1>
          <p>
            Uma vitrine moderna para imóveis de venda e locação, preparada para
            integrar corretores, fotos, atendimento e gestão em um único sistema.
          </p>
          <div className="actions">
            <a className="button primary" href="#imoveis">Ver imóveis</a>
            <a className="button secondary" href="#contato">Falar com um corretor</a>
          </div>
        </div>
      </section>

      <section className="container section" id="imoveis">
        <div className="sectionHeading">
          <div>
            <span className="eyebrow">EM CONSTRUÇÃO</span>
            <h2>Fundação do projeto pronta</h2>
          </div>
          <p>Os próximos passos serão busca, cadastro, galeria e painel.</p>
        </div>
        <div className="grid">
          {highlights.map((item) => (
            <article className="card" key={item}>
              <h3>{item}</h3>
              <p>Estrutura preparada para evoluir sem perder funcionalidades.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container section" id="contato">
        <div className="contactCard">
          <div>
            <span className="eyebrow">ATENDIMENTO</span>
            <h2>Contato pelo WhatsApp será vinculado ao corretor responsável.</h2>
          </div>
          <p>O número será configurado de forma segura pelas variáveis de ambiente.</p>
        </div>
      </section>
    </main>
  );
}

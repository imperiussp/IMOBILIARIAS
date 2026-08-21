export type Property = {
  code: string;
  slug: string;
  title: string;
  city: string;
  neighborhood: string;
  purpose: "Venda" | "Locação";
  category: string;
  price: string;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  area: string;
  description: string;
  features: string[];
  images: string[];
  broker: {
    name: string;
    whatsapp: string;
    creci: string;
  };
};

const broker = { name: "Corretor responsável", whatsapp: "5543999999999", creci: "CRECI a configurar" };

export const properties: Property[] = [
  {
    code: "IM-101", slug: "casa-jardim-suite-senges-im-101", title: "Casa com jardim e suíte", city: "Sengés - PR", neighborhood: "Centro", purpose: "Venda", category: "Casa", price: "R$ 485.000", bedrooms: 3, bathrooms: 2, parking: 2, area: "168 m²",
    description: "Casa bem distribuída, com área social integrada, suíte, jardim e garagem para dois veículos. Ideal para quem procura conforto próximo aos serviços do centro.",
    features: ["Suíte", "Jardim", "Cozinha integrada", "Lavanderia", "Garagem coberta"],
    images: ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=82"], broker
  },
  {
    code: "IM-102", slug: "apartamento-central-varanda-itarare-im-102", title: "Apartamento central com varanda", city: "Itararé - SP", neighborhood: "Centro", purpose: "Locação", category: "Apartamento", price: "R$ 1.850/mês", bedrooms: 2, bathrooms: 2, parking: 1, area: "82 m²",
    description: "Apartamento funcional em localização central, com varanda, suíte e vaga de garagem. Boa opção para quem quer mobilidade e praticidade no dia a dia.",
    features: ["Varanda", "Suíte", "Elevador", "1 vaga", "Boa iluminação"],
    images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=82"], broker
  },
  {
    code: "IM-103", slug: "chacara-area-verde-senges-im-103", title: "Chácara com ampla área verde", city: "Sengés - PR", neighborhood: "Zona Rural", purpose: "Venda", category: "Rural", price: "R$ 690.000", bedrooms: 4, bathrooms: 3, parking: 4, area: "5.000 m²",
    description: "Chácara voltada para lazer e moradia, com ampla área verde, residência principal espaçosa e terreno preparado para diferentes usos.",
    features: ["Área verde", "4 quartos", "Espaço para lazer", "Acesso para veículos", "5.000 m²"],
    images: ["https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1400&q=82"], broker
  },
  {
    code: "IM-104", slug: "casa-moderna-area-gourmet-im-104", title: "Casa moderna com área gourmet", city: "Itararé - SP", neighborhood: "Vila Nova", purpose: "Venda", category: "Casa", price: "R$ 575.000", bedrooms: 3, bathrooms: 3, parking: 2, area: "190 m²",
    description: "Residência moderna com ambientes integrados, área gourmet coberta e bom aproveitamento de iluminação natural.",
    features: ["Área gourmet", "Suíte", "Sala integrada", "Garagem coberta", "Quintal"],
    images: ["https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=82"], broker
  },
  {
    code: "IM-105", slug: "sala-comercial-centro-im-105", title: "Sala comercial pronta para uso", city: "Sengés - PR", neighborhood: "Centro", purpose: "Locação", category: "Comercial", price: "R$ 2.400/mês", bedrooms: 0, bathrooms: 2, parking: 2, area: "115 m²",
    description: "Espaço comercial versátil para escritório, consultório ou atendimento, com fácil acesso e boa visibilidade.",
    features: ["Recepção", "2 banheiros", "Estacionamento", "Acesso central", "Fachada comercial"],
    images: ["https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1400&q=82"], broker
  },
  {
    code: "IM-106", slug: "apartamento-3-quartos-im-106", title: "Apartamento com 3 quartos e suíte", city: "Itararé - SP", neighborhood: "Jardim Alvorada", purpose: "Venda", category: "Apartamento", price: "R$ 395.000", bedrooms: 3, bathrooms: 2, parking: 1, area: "96 m²",
    description: "Apartamento espaçoso, com três quartos, suíte, boa iluminação e distribuição funcional para famílias.",
    features: ["Suíte", "Sacada", "1 vaga", "Cozinha planejada", "Boa ventilação"],
    images: ["https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1560185008-b033106af5c3?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=1400&q=82"], broker
  },
  {
    code: "IM-107", slug: "casa-locacao-quintal-im-107", title: "Casa para locação com quintal", city: "Sengés - PR", neighborhood: "Jardim Primavera", purpose: "Locação", category: "Casa", price: "R$ 1.600/mês", bedrooms: 2, bathrooms: 1, parking: 2, area: "110 m²",
    description: "Casa prática para locação, com quintal, garagem e ambientes bem distribuídos para o dia a dia.",
    features: ["Quintal", "2 vagas", "Lavanderia", "Cozinha ampla", "Área residencial"],
    images: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1400&q=82"], broker
  },
  {
    code: "IM-108", slug: "sitio-producao-lazer-im-108", title: "Sítio para produção e lazer", city: "Itararé - SP", neighborhood: "Zona Rural", purpose: "Venda", category: "Rural", price: "R$ 980.000", bedrooms: 3, bathrooms: 2, parking: 6, area: "18.000 m²",
    description: "Propriedade rural com área ampla, acesso para veículos e espaço adequado tanto para lazer quanto para pequenas atividades produtivas.",
    features: ["18.000 m²", "Casa sede", "Área de cultivo", "Acesso para veículos", "Espaço de lazer"],
    images: ["https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=82", "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=82"], broker
  }
];

export function getPropertyBySlug(slug: string) {
  return properties.find((property) => property.slug === slug);
}

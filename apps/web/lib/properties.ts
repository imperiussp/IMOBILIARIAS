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

export const properties: Property[] = [
  {
    code: "IM-101",
    slug: "casa-jardim-suite-senges-im-101",
    title: "Casa com jardim e suíte",
    city: "Sengés - PR",
    neighborhood: "Centro",
    purpose: "Venda",
    category: "Casa",
    price: "R$ 485.000",
    bedrooms: 3,
    bathrooms: 2,
    parking: 2,
    area: "168 m²",
    description: "Casa bem distribuída, com área social integrada, suíte, jardim e garagem para dois veículos. Ideal para quem procura conforto próximo aos serviços do centro.",
    features: ["Suíte", "Jardim", "Cozinha integrada", "Lavanderia", "Garagem coberta"],
    images: [
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=82",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=82",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=82"
    ],
    broker: { name: "Corretor responsável", whatsapp: "5543999999999", creci: "CRECI a configurar" }
  },
  {
    code: "IM-102",
    slug: "apartamento-central-varanda-itarare-im-102",
    title: "Apartamento central com varanda",
    city: "Itararé - SP",
    neighborhood: "Centro",
    purpose: "Locação",
    category: "Apartamento",
    price: "R$ 1.850/mês",
    bedrooms: 2,
    bathrooms: 2,
    parking: 1,
    area: "82 m²",
    description: "Apartamento funcional em localização central, com varanda, suíte e vaga de garagem. Boa opção para quem quer mobilidade e praticidade no dia a dia.",
    features: ["Varanda", "Suíte", "Elevador", "1 vaga", "Boa iluminação"],
    images: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=82",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1400&q=82",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1400&q=82"
    ],
    broker: { name: "Corretor responsável", whatsapp: "5543999999999", creci: "CRECI a configurar" }
  },
  {
    code: "IM-103",
    slug: "chacara-area-verde-senges-im-103",
    title: "Chácara com ampla área verde",
    city: "Sengés - PR",
    neighborhood: "Zona Rural",
    purpose: "Venda",
    category: "Rural",
    price: "R$ 690.000",
    bedrooms: 4,
    bathrooms: 3,
    parking: 4,
    area: "5.000 m²",
    description: "Chácara voltada para lazer e moradia, com ampla área verde, residência principal espaçosa e terreno preparado para diferentes usos.",
    features: ["Área verde", "4 quartos", "Espaço para lazer", "Acesso para veículos", "5.000 m²"],
    images: [
      "https://images.unsplash.com/photo-1500076656116-558758c991c1?auto=format&fit=crop&w=1400&q=82",
      "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=82",
      "https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1400&q=82"
    ],
    broker: { name: "Corretor responsável", whatsapp: "5543999999999", creci: "CRECI a configurar" }
  }
];

export function getPropertyBySlug(slug: string) {
  return properties.find((property) => property.slug === slug);
}

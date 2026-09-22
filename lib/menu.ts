/**
 * Cardápio do evento. Editar aqui já muda o site inteiro — a página lê daqui.
 * Preços em reais.
 */
export type MenuItem = { name: string; price: number; note?: string };
export type MenuGroup = { title: string; kicker: string; items: MenuItem[] };

export const MENU: MenuGroup[] = [
  {
    title: "Cervejas",
    kicker: "GELADAS",
    items: [
      { name: "Brahma", price: 7 },
      { name: "Itaipava", price: 7 },
      { name: "Devassa", price: 8 },
      { name: "Heineken", price: 12 },
    ],
  },
  {
    title: "Drinks",
    kicker: "NA MEDIDA",
    items: [
      { name: "Caipirinha", price: 7 },
      { name: "Caipivodka", price: 9 },
      { name: "Copão Vodka com energético", price: 12 },
    ],
  },
  {
    title: "Sem álcool",
    kicker: "PRA SEGURAR A ONDA",
    items: [
      { name: "Refrigerante (lata)", price: 6 },
      { name: "Água", price: 4 },
    ],
  },
];

export const brl = (reais: number) => `R$ ${reais.toFixed(2).replace(".", ",")}`;

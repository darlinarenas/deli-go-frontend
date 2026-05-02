/* ======================================================
   DELI - database.js
   Base central de datos del proyecto
====================================================== */

window.DELI_DB = {
  restaurants: [
    {
      id: 1,
      name: "Burger House",
      type: "Hamburguesas",
      category: "Hamburguesas",
      rating: "4.8",
      delivery: "$2000",
      time: "25 min",
      popular: true,
      menu: [
        { id: 1, name: "Hamburguesa clásica", desc: "Carne, queso, lechuga", price: 5000, popular: true },
        { id: 2, name: "Doble queso", desc: "Doble carne + cheddar", price: 6500, popular: false },
        { id: 3, name: "Hamburguesa BBQ", desc: "Salsa BBQ + cebolla crispy", price: 6800, popular: true },
        { id: 4, name: "Papas fritas", desc: "Clásicas crocantes", price: 2500, popular: false },
        { id: 5, name: "Combo clásico", desc: "Burger + papas + bebida", price: 8500, popular: true }
      ]
    },

    {
      id: 2,
      name: "Pizza Roma",
      type: "Pizza",
      category: "Pizzas",
      rating: "4.7",
      delivery: "$1800",
      time: "30 min",
      popular: true,
      menu: [
        { id: 1, name: "Pizza Pepperoni", desc: "Masa artesanal y pepperoni", price: 8000, popular: true },
        { id: 2, name: "Pizza Hawaiana", desc: "Jamón y piña", price: 7800, popular: false },
        { id: 3, name: "Pizza Cuatro Quesos", desc: "Mezcla de quesos", price: 8900, popular: true },
        { id: 4, name: "Refresco 1.5L", desc: "Bebida para compartir", price: 2500, popular: false },
        { id: 5, name: "Combo Pizza", desc: "Pizza + bebida", price: 9900, popular: true }
      ]
    },

    {
      id: 3,
      name: "Sushi Go",
      type: "Sushi",
      category: "Sushi",
      rating: "4.9",
      delivery: "$2200",
      time: "35 min",
      popular: true,
      menu: [
        { id: 1, name: "California Roll", desc: "Cangrejo, palta y queso", price: 6500, popular: true },
        { id: 2, name: "Tempura Roll", desc: "Sushi crujiente", price: 7200, popular: false },
        { id: 3, name: "Nigiri Salmón", desc: "Porción de salmón", price: 5400, popular: false },
        { id: 4, name: "Gohan", desc: "Arroz, proteína y toppings", price: 6900, popular: true },
        { id: 5, name: "Bebida", desc: "Lata 350ml", price: 1500, popular: false }
      ]
    },

    {
      id: 4,
      name: "Pollo Express",
      type: "Pollo",
      category: "Pollo",
      rating: "4.6",
      delivery: "$1700",
      time: "28 min",
      popular: false,
      menu: [
        { id: 1, name: "Pollo broaster", desc: "Crujiente y jugoso", price: 6200, popular: true },
        { id: 2, name: "Alitas BBQ", desc: "8 piezas", price: 5900, popular: true },
        { id: 3, name: "Combo pollo", desc: "Pollo + papas + bebida", price: 8500, popular: true },
        { id: 4, name: "Papas grandes", desc: "Porción familiar", price: 3500, popular: false },
        { id: 5, name: "Salsa extra", desc: "BBQ / ajo", price: 500, popular: false }
      ]
    },

    {
      id: 5,
      name: "Taco Fuego",
      type: "Mexicana",
      category: "Mexicana",
      rating: "4.5",
      delivery: "$1900",
      time: "27 min",
      popular: false,
      menu: [
        { id: 1, name: "Taco de carne", desc: "Con guacamole", price: 3200, popular: true },
        { id: 2, name: "Burrito mixto", desc: "Carne y pollo", price: 6100, popular: true },
        { id: 3, name: "Quesadilla", desc: "Queso fundido", price: 4800, popular: false },
        { id: 4, name: "Nachos", desc: "Con queso y jalapeños", price: 4500, popular: false },
        { id: 5, name: "Combo mexicano", desc: "Taco + bebida", price: 7200, popular: true }
      ]
    }
  ]
};

/* ======================================================
   Categorías automáticas
====================================================== */
window.DELI_DB.cats = [...new Set(window.DELI_DB.restaurants.map((r) => r.category))];
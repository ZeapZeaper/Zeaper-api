/**
 * report.js
 * Report resolver — serves report metadata cards for the frontend dashboard.
 * Each report card contains enough information for the frontend to display it
 * and to fetch the actual data by calling the corresponding endpoint.
 */

/**
 * @typedef {Object} ReportCard
 * @property {string} id            - Unique stable identifier
 * @property {string} title         - Display title shown on the card
 * @property {string} description   - Short description of what the report shows
 * @property {string} category      - Grouping: "orders" | "products" | "customers" | "revenue"
 * @property {string} channel       - "online" | "in-store" | "combined"
 * @property {string} endpoint      - API path the frontend should call for data
 * @property {string} method        - HTTP method ("GET" | "POST")
 * @property {Object[]} filters     - Supported query/body params the frontend can pass
 * @property {string} icon          - Suggested icon name (frontend can map to its icon lib)
 * @property {boolean} available    - Whether the endpoint is implemented and ready
 */

/** @type {ReportCard[]} */
const ORDER_REPORTS = [
  // ─── COMBINED ─────────────────────────────────────────────────────────────
  {
    id: "all-orders-summary",
    title: "All Orders Summary",
    description:
      "High-level count and breakdown of every order across all channels within a date range.",
    category: "orders",
    channel: "combined",
    endpoint: "/report/orders",
    method: "GET",
    filters: [
      {
        key: "channel",
        type: "string",
        options: ["online", "in-store"],
        description: "Filter by channel",
      },
      { key: "limit", type: "number", description: "Page size" },
      { key: "pageNumber", type: "number", description: "Page number" },
    ],
    icon: "clipboard-list",
    available: true,
  },
  {
    id: "order-status-distribution",
    title: "Order Status Distribution",
    description:
      "Breakdown of product orders by status (placed, confirmed, dispatched, delivered, cancelled) across all channels.",
    category: "orders",
    channel: "combined",
    endpoint: "/report/orders/products",
    method: "GET",
    filters: [
      {
        key: "status",
        type: "string",
        description: "Filter by a specific status value",
      },
      { key: "shop", type: "string", description: "Filter by shop ID" },
      { key: "limit", type: "number", description: "Page size" },
      { key: "pageNumber", type: "number", description: "Page number" },
    ],
    icon: "chart-pie",
    available: true,
  },

  // ─── ONLINE ───────────────────────────────────────────────────────────────
  {
    id: "online-orders-summary",
    title: "Online Orders Summary",
    description:
      "All orders placed through the online channel, with customer, payment and delivery details.",
    category: "orders",
    channel: "online",
    endpoint: "/report/orders",
    method: "GET",
    filters: [
      {
        key: "channel",
        type: "string",
        value: "online",
        description: "Pre-filtered to online",
      },
      { key: "limit", type: "number", description: "Page size" },
      { key: "pageNumber", type: "number", description: "Page number" },
    ],
    icon: "shopping-cart",
    available: true,
  },
  {
    id: "online-product-order-analytics",
    title: "Online Product Order Analytics",
    description:
      "Products sold, revenue by shop, order status counts and group breakdown for online orders.",
    category: "products",
    channel: "online",
    endpoint: "/report/analytics/products/general",
    method: "GET",
    filters: [],
    icon: "chart-bar",
    available: true,
  },
  {
    id: "online-orders-count-by-date",
    title: "Online Orders Count by Date",
    description:
      "Total number of product orders placed within a selected date range.",
    category: "orders",
    channel: "online",
    endpoint: "/report/analytics/count/productOrders/date",
    method: "GET",
    filters: [
      {
        key: "fromDate",
        type: "date",
        required: true,
        description: "Start date (YYYY-MM-DD)",
      },
      {
        key: "toDate",
        type: "date",
        required: true,
        description: "End date (YYYY-MM-DD)",
      },
    ],
    icon: "calendar",
    available: true,
  },

  // ─── IN-STORE ─────────────────────────────────────────────────────────────
  {
    id: "instore-orders-analytics",
    title: "In-Store Sales Analytics",
    description:
      "Comprehensive in-store dashboard: revenue, items sold, unique customers, top products, top sales agents, daily trend and payment method breakdown.",
    category: "orders",
    channel: "in-store",
    endpoint: "/report/analytics/instore/orders",
    method: "GET",
    filters: [
      {
        key: "fromDate",
        type: "date",
        description: "Start date (YYYY-MM-DD). Defaults to last 30 days.",
      },
      {
        key: "toDate",
        type: "date",
        description: "End date (YYYY-MM-DD). Defaults to today.",
      },
      {
        key: "limit",
        type: "number",
        description: "Number of items in top lists (max 20, default 5)",
      },
    ],
    icon: "store",
    available: true,
  },
  {
    id: "instore-customers",
    title: "In-Store Customers",
    description:
      "List of unique in-store customers grouped by phone number, showing order count, first and last order dates.",
    category: "customers",
    channel: "in-store",
    endpoint: "/report/order/instore/customers",
    method: "GET",
    filters: [
      {
        key: "search",
        type: "string",
        description: "Search by customer name or phone number",
      },
    ],
    icon: "users",
    available: true,
  },
  {
    id: "instore-orders-list",
    title: "In-Store Orders List",
    description:
      "Paginated list of all in-store orders with customer details, items, payment method and sales agent.",
    category: "orders",
    channel: "in-store",
    endpoint: "/report/orders",
    method: "GET",
    filters: [
      {
        key: "channel",
        type: "string",
        value: "in-store",
        description: "Pre-filtered to in-store",
      },
    ],
    icon: "receipt",
    available: true,
  },
];

/**
 * GET /reports/orders/available
 * Returns the list of available order report cards.
 * Supports optional ?channel= filter.
 */
const getAvailableOrderReports = async (req, res) => {
  try {
    const { channel, category } = req.query;

    let reports = ORDER_REPORTS;

    if (channel) {
      reports = reports.filter(
        (r) => r.channel === channel || r.channel === "combined",
      );
    }

    if (category) {
      reports = reports.filter((r) => r.category === category);
    }

    const channels = [...new Set(ORDER_REPORTS.map((r) => r.channel))];
    const categories = [...new Set(ORDER_REPORTS.map((r) => r.category))];

    return res.status(200).send({
      data: {
        reports,
        meta: {
          total: reports.length,
          channels,
          categories,
        },
      },
      message: "Available order reports fetched successfully",
    });
  } catch (err) {
    return res.status(500).send({ error: err.message });
  }
};

module.exports = {
  getAvailableOrderReports,
};

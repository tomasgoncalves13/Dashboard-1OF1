// Centralised GraphQL queries. Keep field selections lean — Shopify charges
// query cost per node, and we paginate via cursor (`after`).

export const PRODUCTS_QUERY = /* GraphQL */ `
  query Products($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          description
          vendor
          productType
          tags
          status
          featuredImage { url }
          variants(first: 100) {
            edges {
              node {
                id
                sku
                barcode
                title
                price
                compareAtPrice
                inventoryQuantity
                inventoryItem { id unitCost { amount currencyCode } }
              }
            }
          }
        }
      }
    }
  }
`;

export const CUSTOMERS_QUERY = /* GraphQL */ `
  query Customers($cursor: String) {
    customers(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          email
          firstName
          lastName
          phone
          numberOfOrders
          amountSpent { amount currencyCode }
          createdAt
          updatedAt
          emailMarketingConsent { marketingState }
          defaultAddress { country city }
        }
      }
    }
  }
`;

// Orders include lines, transactions (fees), shipping, refunds.
export const ORDERS_QUERY = /* GraphQL */ `
  query Orders($cursor: String, $query: String) {
    orders(first: 50, after: $cursor, query: $query, sortKey: PROCESSED_AT) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          name
          processedAt
          createdAt
          updatedAt
          cancelledAt
          displayFinancialStatus
          displayFulfillmentStatus
          paymentGatewayNames
          currencyCode
          customer { id }
          shippingAddress { countryCodeV2 city }
          subtotalPriceSet { shopMoney { amount } }
          totalDiscountsSet { shopMoney { amount } }
          totalShippingPriceSet { shopMoney { amount } }
          totalTaxSet { shopMoney { amount } }
          totalPriceSet { shopMoney { amount } }
          totalRefundedSet { shopMoney { amount } }
          lineItems(first: 100) {
            edges {
              node {
                id
                title
                sku
                quantity
                discountedUnitPriceSet { shopMoney { amount } }
                originalUnitPriceSet { shopMoney { amount } }
                variant { id inventoryItem { unitCost { amount } } }
              }
            }
          }
          transactions(first: 20) {
            id
            status
            kind
            amountSet { shopMoney { amount } }
            fees { amount { amount } }
          }
        }
      }
    }
  }
`;

export const SHOP_QUERY = /* GraphQL */ `
  query Shop {
    shop {
      id
      name
      myshopifyDomain
      currencyCode
      primaryDomain { url }
      ianaTimezone
    }
  }
`;

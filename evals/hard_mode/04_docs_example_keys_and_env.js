// 04_docs_example_keys_and_env.js — Safe env references, placeholders, and public publishable key
export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY,
  publishableKey: 'pk_live_51N8xKpL9mQ2vR7tW4yZ6aB3cD5eF7gH9',
};

export const docsExampleSnippets = {
  livePlaceholder: 'sk_live_YOUR_SECRET_KEY_HERE',
  liveCamelPlaceholder: 'sk_live_YOURSECRETKEYHERE1234',
  // Dynamic 0{24} placeholder suppression is tested at runtime in hard-mode.test.mjs
};

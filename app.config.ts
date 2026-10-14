export default defineAppConfig({
  ui: {
    primary: 'amber',
    gray: 'neutral',
    icons: {
      dynamic: true,
    },
    card: {
      base: 'ledger-card',
      rounded: 'rounded-md',
      shadow: 'shadow-none',
      body: { padding: 'p-5 sm:p-6' },
      background: 'bg-white dark:bg-[#17140f]',
      ring: 'ring-1 ring-[#e7e1d3] dark:ring-white/10',
    },
    button: {
      rounded: 'rounded-sm',
      font: 'font-medium',
      default: { size: 'sm' },
    },
    notifications: {
      position: 'top-0 right-0',
    },
  },
})

const styles = {
  loading: {
    padding: '40px',
    textAlign: 'center',
    color: '#8E8B82',
    fontSize: '14px'
  },
  tabContainer: {
    padding: '0 24px',
    borderBottom: '1px solid var(--panel-border)',
    marginBottom: '24px'
  },
  tabBar: {
    display: 'flex',
    gap: '24px'
  },
  tab: {
    padding: '12px 0',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#8E8B82',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  activeTab: {
    padding: '12px 0',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid #141413',
    color: '#141413',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
    padding: '0 24px'
  },
  twoColumnGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    padding: '0 24px'
  },
  card: {
    padding: '24px',
    borderRadius: '16px'
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#141413',
    marginBottom: '16px'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  listItem: {
    padding: '12px',
    backgroundColor: 'rgba(20, 20, 19, 0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(20, 20, 19, 0.05)'
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px'
  },
  itemTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#141413'
  },
  dangerBadge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 8px',
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
    borderRadius: '8px'
  },
  itemDesc: {
    fontSize: '13px',
    color: '#5C5A55',
    marginBottom: '8px'
  },
  itemMeta: {
    fontSize: '11px',
    color: '#8E8B82'
  },
  distGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  distRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: 'rgba(20, 20, 19, 0.02)',
    borderRadius: '8px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px'
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    color: '#8E8B82',
    fontWeight: '500',
    borderBottom: '1px solid rgba(20, 20, 19, 0.08)'
  },
  tr: {
    borderBottom: '1px solid rgba(20, 20, 19, 0.04)'
  },
  td: {
    padding: '12px',
    color: '#141413'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#5C5A55',
    marginBottom: '6px'
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--panel-border)',
    backgroundColor: '#FAF9F5',
    fontSize: '13px',
    outline: 'none'
  },
  uploadBadge: {
    fontSize: '10px',
    padding: '2px 8px',
    backgroundColor: '#E0E7FF',
    color: '#4F46E5',
    borderRadius: '6px',
    fontWeight: '600'
  },
  chatBadge: {
    fontSize: '10px',
    padding: '2px 8px',
    backgroundColor: '#D1FAE5',
    color: '#059669',
    borderRadius: '6px',
    fontWeight: '600'
  }
};

export default styles;

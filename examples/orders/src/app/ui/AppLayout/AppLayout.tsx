import type { ReactNode } from 'react';

import { Button } from 'shared/ui/Button';

import styles from './AppLayout.module.css';

type TypeSection = 'orders' | 'customers' | 'invoices';

type PropsAppLayout = {
  activeSection: TypeSection;
  children: ReactNode;
  onSectionChange: (section: TypeSection) => void;
};

const sections: Array<{ id: TypeSection; label: string }> = [
  { id: 'orders', label: 'Orders' },
  { id: 'customers', label: 'Customers' },
  { id: 'invoices', label: 'Invoices' },
];

export function AppLayout({ activeSection, children, onSectionChange }: PropsAppLayout) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ARFA Generator demo</p>
          <h1>Order Management</h1>
        </div>
        <nav className={styles.nav} aria-label="Main navigation">
          {sections.map((section) => (
            <Button
              key={section.id}
              variant={activeSection === section.id ? 'primary' : 'secondary'}
              onClick={() => onSectionChange(section.id)}
            >
              {section.label}
            </Button>
          ))}
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

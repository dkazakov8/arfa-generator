import styles from './EmptyState.module.css';

type PropsEmptyState = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: PropsEmptyState) {
  return (
    <div className={styles.empty}>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

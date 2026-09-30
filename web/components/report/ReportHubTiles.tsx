import { Grid } from '../layout';
import { NavTile } from '../nav';
import { cx } from '../../lib/cx';
import styles from './ReportHubTiles.module.css';
import type { HubTileData } from './types';

export interface ReportHubTilesProps {
  tiles: HubTileData[];
  /** Names the navigation, e.g. "Report sections". */
  label: string;
  className?: string;
}

/** The `/report` hub: counts and links to providers, families, detectors and news. Never a result. */
export function ReportHubTiles({ tiles, label, className }: ReportHubTilesProps) {
  return (
    <nav className={cx(styles.hub, className)} aria-label={label}>
      <Grid columns={4} gap="md">
        {tiles.map(tile => (
          <NavTile
            key={tile.href}
            href={tile.href}
            label={tile.label}
            figure={tile.figure}
            figureUnit={tile.figureUnit}
            action={tile.action}
            description={<>{tile.emphasis && <b>{tile.emphasis}</b>} {tile.text}</>}
          />
        ))}
      </Grid>
    </nav>
  );
}

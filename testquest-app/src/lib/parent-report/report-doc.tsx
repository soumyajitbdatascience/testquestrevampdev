/**
 * Parent-report PDF document — Task 3.1 + branded in Task 3.6.
 *
 * Renders a one-page parent report with header, big-stat row, score-trend
 * SVG sparkline, weak-topics table, batch comparison, and footer.
 *
 * Branding: pass an optional `branding` prop with `primaryColor`, `logoUrl`,
 * `orgDisplayName`, and support contact. When omitted (B2C / no white-label
 * plan), the doc falls back to the default Testquest gold (`#e89b3c`) and
 * the textual "Testquest" wordmark.
 */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Svg,
  Path,
  Line,
  Circle,
} from "@react-pdf/renderer";

const DEFAULT_ACCENT = "#e89b3c";
const INK = "#111111";
const MUTED = "#666666";
const RULE = "#dddddd";
const SOFT = "#f6f6f6";

function makeStyles(accent: string) {
  return StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: INK, fontFamily: "Helvetica" },
  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderBottomColor: accent,
    paddingBottom: 10,
    marginBottom: 16,
  },
  headerBrandRow: { flexDirection: "row", alignItems: "center" },
  headerLogo: { maxHeight: 28, maxWidth: 120, marginRight: 10 },
  centreName: { fontSize: 16, fontWeight: 700 },
  reportLabel: { fontSize: 9, color: MUTED, marginTop: 2 },
  studentBlock: { alignItems: "flex-end" },
  studentName: { fontSize: 12, fontWeight: 700 },
  studentMeta: { fontSize: 9, color: MUTED },

  // Stat row
  statRow: { flexDirection: "row", marginBottom: 18 },
  statCell: {
    flex: 1,
    backgroundColor: SOFT,
    borderRadius: 4,
    padding: 10,
    marginRight: 8,
  },
  statCellLast: { marginRight: 0 },
  statLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontWeight: 700, marginTop: 4 },
  statSub: { fontSize: 8, color: MUTED, marginTop: 2 },

  // Section
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 6, color: INK },
  sectionSub: { fontSize: 9, color: MUTED, marginBottom: 8 },
  section: { marginBottom: 18 },

  // Trend chart container
  chartBox: { borderWidth: 1, borderColor: RULE, borderRadius: 4, padding: 8 },

  // Table
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: RULE,
    paddingVertical: 4,
  },
  th: { fontSize: 9, fontWeight: 700, color: INK },
  td: { fontSize: 9, color: INK },
  colSubject: { flex: 2 },
  colDifficulty: { flex: 1 },
  colAttempted: { flex: 1, textAlign: "right" },
  colAccuracy: { flex: 1, textAlign: "right" },

  // Comparison
  comparisonRow: { flexDirection: "row" },
  comparisonCell: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: RULE,
    borderRadius: 4,
    marginRight: 8,
  },
  comparisonCellLast: { marginRight: 0 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: RULE,
    paddingTop: 6,
    fontSize: 8,
    color: MUTED,
    textAlign: "center",
  },

  empty: { fontSize: 9, color: MUTED, fontStyle: "italic" },
  });
}
type ReportStyles = ReturnType<typeof makeStyles>;

export interface TrendPoint {
  /** Label for the week, e.g. "W1" or "Apr 28". */
  label: string;
  /** Percentage 0–100 (null if no attempts that week). */
  pct: number | null;
}

export interface WeakTopic {
  subject: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  attempted: number;
  accuracyPct: number;
}

export interface PdfBranding {
  /** Override centre/org name in the header. Defaults to `props.orgName`. */
  orgDisplayName?: string;
  /** Remote logo URL (React-PDF supports <Image src={...} />). Replaces the
   *  default Testquest wordmark in the header. */
  logoUrl?: string;
  /** CSS color string — replaces the default `#e89b3c` accent across the
   *  header rule, trend chart line/dots, weak-topic table header, and
   *  comparison-cell labels. */
  primaryColor?: string;
  supportEmail?: string;
  supportPhone?: string;
}

export interface ParentReportProps {
  orgName: string;
  studentName: string;
  batchName: string;
  className: string | null;
  periodLabel: string; // e.g. "1 May – 28 May 2026"
  generatedAt: Date;

  attemptsCount: number;
  averagePct: number;
  attendancePct: number; // % of assigned tests with a completed attempt
  assignedCount: number;
  completedCount: number;

  trend: TrendPoint[];
  weakTopics: WeakTopic[];

  batchAveragePct: number;
  batchSize: number;

  /** Optional org branding. Undefined → default Testquest palette + wordmark. */
  branding?: PdfBranding;
}

// ─── Sub-components ────────────────────────────────────────────────

const Header: React.FC<{
  styles: ReportStyles;
  orgName: string;
  periodLabel: string;
  studentName: string;
  className: string | null;
  batchName: string;
  logoUrl?: string;
}> = ({
  styles, orgName, periodLabel, studentName, className, batchName, logoUrl,
}) => (
  <View style={styles.headerRow}>
    <View>
      <View style={styles.headerBrandRow}>
        {logoUrl ? (
          // React-PDF accepts remote URLs on <Image>. If the URL is unreachable
          // at render time react-pdf throws; we surface that as a 500 to the
          // caller rather than silently falling back.
          <Image src={logoUrl} style={styles.headerLogo} />
        ) : null}
        <Text style={styles.centreName}>{orgName}</Text>
      </View>
      <Text style={styles.reportLabel}>Parent report · {periodLabel}</Text>
    </View>
    <View style={styles.studentBlock}>
      <Text style={styles.studentName}>{studentName}</Text>
      <Text style={styles.studentMeta}>
        {batchName}{className ? ` · ${className}` : ""}
      </Text>
    </View>
  </View>
);

const StatRow: React.FC<{ styles: ReportStyles; attemptsCount: number; averagePct: number; attendancePct: number; assignedCount: number; completedCount: number }> = ({
  styles, attemptsCount, averagePct, attendancePct, assignedCount, completedCount,
}) => (
  <View style={styles.statRow}>
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>Tests attempted</Text>
      <Text style={styles.statValue}>{attemptsCount}</Text>
      <Text style={styles.statSub}>in the last 4 weeks</Text>
    </View>
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>Average score</Text>
      <Text style={styles.statValue}>{averagePct.toFixed(0)}%</Text>
      <Text style={styles.statSub}>across attempts</Text>
    </View>
    <View style={[styles.statCell, styles.statCellLast]}>
      <Text style={styles.statLabel}>Attendance</Text>
      <Text style={styles.statValue}>{attendancePct.toFixed(0)}%</Text>
      <Text style={styles.statSub}>{completedCount}/{assignedCount} assigned</Text>
    </View>
  </View>
);

/**
 * Score trend rendered as an SVG sparkline. Weeks with no attempts are drawn
 * as gaps (line skips them). The Y axis is fixed at 0–100 so the slope is
 * directly comparable across reports.
 */
const TrendChart: React.FC<{ styles: ReportStyles; accent: string; trend: TrendPoint[] }> = ({ styles, accent, trend }) => {
  const width = 520;
  const height = 110;
  const padL = 24, padR = 8, padT = 8, padB = 22;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  if (trend.length === 0) {
    return (
      <View style={styles.chartBox}>
        <Text style={styles.empty}>No score history yet.</Text>
      </View>
    );
  }

  const stepX = trend.length > 1 ? innerW / (trend.length - 1) : 0;
  const y = (pct: number) => padT + innerH - (pct / 100) * innerH;
  const x = (i: number) => padL + i * stepX;

  // Build the path, breaking the line where pct is null.
  let d = "";
  let pen = false;
  trend.forEach((p, i) => {
    if (p.pct === null) { pen = false; return; }
    const cmd = pen ? "L" : "M";
    d += `${cmd}${x(i).toFixed(1)},${y(p.pct).toFixed(1)} `;
    pen = true;
  });

  return (
    <View style={styles.chartBox}>
      <Svg width={width} height={height}>
        {/* Y-axis gridlines at 25/50/75/100 */}
        {[0, 25, 50, 75, 100].map((g) => (
          <Line
            key={g}
            x1={padL} y1={y(g)} x2={padL + innerW} y2={y(g)}
            strokeWidth={0.5} stroke={g === 0 ? INK : RULE}
          />
        ))}
        {/* Labels for the Y-axis */}
        {[0, 50, 100].map((g) => (
          <Text key={`yl-${g}`} x={4} y={y(g) + 3} style={{ fontSize: 7, fill: MUTED }}>
            {g}
          </Text>
        ))}
        {/* The trend path itself */}
        {d.length > 0 && (
          <Path d={d.trim()} stroke={accent} strokeWidth={2} fill="none" />
        )}
        {/* Points */}
        {trend.map((p, i) =>
          p.pct === null ? null : (
            <Circle key={`pt-${i}`} cx={x(i)} cy={y(p.pct)} r={2.5} fill={accent} />
          ),
        )}
        {/* X labels */}
        {trend.map((p, i) => (
          <Text
            key={`xl-${i}`}
            x={x(i)}
            y={height - 6}
            style={{ fontSize: 7, fill: MUTED, textAnchor: "middle" }}
          >
            {p.label}
          </Text>
        ))}
      </Svg>
    </View>
  );
};

const WeakTopicsTable: React.FC<{ styles: ReportStyles; rows: WeakTopic[] }> = ({ styles, rows }) => {
  if (rows.length === 0) {
    return <Text style={styles.empty}>No weak-topic signal yet — needs more attempts.</Text>;
  }
  return (
    <View>
      <View style={styles.tableHeader}>
        <Text style={[styles.th, styles.colSubject]}>Subject</Text>
        <Text style={[styles.th, styles.colDifficulty]}>Difficulty</Text>
        <Text style={[styles.th, styles.colAttempted]}>Attempted</Text>
        <Text style={[styles.th, styles.colAccuracy]}>Accuracy</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={[styles.td, styles.colSubject]}>{r.subject}</Text>
          <Text style={[styles.td, styles.colDifficulty]}>{r.difficulty}</Text>
          <Text style={[styles.td, styles.colAttempted]}>{r.attempted}</Text>
          <Text style={[styles.td, styles.colAccuracy]}>{r.accuracyPct.toFixed(0)}%</Text>
        </View>
      ))}
    </View>
  );
};

const Comparison: React.FC<{ styles: ReportStyles; studentPct: number; batchPct: number; batchSize: number }> = ({
  styles, studentPct, batchPct, batchSize,
}) => {
  const diff = studentPct - batchPct;
  const diffLabel =
    diff > 0.5  ? `+${diff.toFixed(0)} pts above batch` :
    diff < -0.5 ? `${diff.toFixed(0)} pts below batch` :
                  "in line with batch";
  return (
    <View style={styles.comparisonRow}>
      <View style={styles.comparisonCell}>
        <Text style={styles.statLabel}>Student average</Text>
        <Text style={styles.statValue}>{studentPct.toFixed(0)}%</Text>
      </View>
      <View style={styles.comparisonCell}>
        <Text style={styles.statLabel}>Batch average</Text>
        <Text style={styles.statValue}>{batchPct.toFixed(0)}%</Text>
        <Text style={styles.statSub}>across {batchSize} student{batchSize === 1 ? "" : "s"}</Text>
      </View>
      <View style={[styles.comparisonCell, styles.comparisonCellLast]}>
        <Text style={styles.statLabel}>Standing</Text>
        <Text style={styles.statValue}>{diffLabel}</Text>
      </View>
    </View>
  );
};

const Footer: React.FC<{
  styles: ReportStyles;
  generatedAt: Date;
  orgName: string;
  supportEmail?: string;
  supportPhone?: string;
}> = ({ styles, generatedAt, orgName, supportEmail, supportPhone }) => {
  const dateStr = generatedAt.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const contactBits: string[] = [];
  if (supportEmail) contactBits.push(supportEmail);
  if (supportPhone) contactBits.push(supportPhone);
  const contactLine = contactBits.length > 0
    ? ` For any clarification, contact ${orgName} at ${contactBits.join(" / ")}.`
    : " Please contact the centre for any clarification.";
  return (
    <Text style={styles.footer}>
      Generated on {dateStr} for {orgName}. This report is auto-computed from
      recent test activity and is indicative.{contactLine}
    </Text>
  );
};

// ─── Main document ─────────────────────────────────────────────────

export const ParentReportDoc: React.FC<ParentReportProps> = (props) => {
  const accent = props.branding?.primaryColor || DEFAULT_ACCENT;
  const styles = makeStyles(accent);
  const headerName = props.branding?.orgDisplayName || props.orgName;
  return (
    <Document
      title={`Parent report — ${props.studentName}`}
      author={headerName}
      creator="Testquest"
    >
      <Page size="A4" style={styles.page}>
        <Header
          styles={styles}
          orgName={headerName}
          periodLabel={props.periodLabel}
          studentName={props.studentName}
          className={props.className}
          batchName={props.batchName}
          logoUrl={props.branding?.logoUrl}
        />

        <StatRow
          styles={styles}
          attemptsCount={props.attemptsCount}
          averagePct={props.averagePct}
          attendancePct={props.attendancePct}
          assignedCount={props.assignedCount}
          completedCount={props.completedCount}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Score trend</Text>
          <Text style={styles.sectionSub}>Weekly average percentage, last 4 weeks.</Text>
          <TrendChart styles={styles} accent={accent} trend={props.trend} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weak topics</Text>
          <Text style={styles.sectionSub}>
            Subject × difficulty buckets where accuracy is below 60% (lowest first).
          </Text>
          <WeakTopicsTable styles={styles} rows={props.weakTopics} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comparison to batch</Text>
          <Comparison
            styles={styles}
            studentPct={props.averagePct}
            batchPct={props.batchAveragePct}
            batchSize={props.batchSize}
          />
        </View>

        <Footer
          styles={styles}
          generatedAt={props.generatedAt}
          orgName={headerName}
          supportEmail={props.branding?.supportEmail}
          supportPhone={props.branding?.supportPhone}
        />
      </Page>
    </Document>
  );
};

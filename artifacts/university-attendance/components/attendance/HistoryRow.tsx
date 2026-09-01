import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { PulsingView } from '@/components/Motion';
import { HISTORY_ROW_HEIGHT, type AttendanceRecord } from '@/constants/attendance';

type Props = {
  item: AttendanceRecord;
  /** Stagger index; only used the first time a row is seen. */
  index: number;
  /** False for recycled rows so scrolling back never replays the entrance. */
  animate: boolean;
  /** Reported after mount, so a double-render never consumes the entrance. */
  onSeen: (id: string) => void;
};

export const HistoryRow = React.memo(function HistoryRow({ item, index, animate, onSeen }: Props) {
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    onSeen(item.id);
  }, [item.id, onSeen]);

  const [month, day] = item.dateLabel.split(' ');

  return (
    <AnimatedEntrance
      enabled={animate}
      delay={Math.min(index * 55, 400)}
      distance={12}
    >
      <View style={styles.historyRow}>
        <View style={styles.historyDate}>
          <Text style={styles.historyDateText}>{day?.replace(',', '') ?? '--'}</Text>
          <Text style={styles.historyMonthText}>{month}</Text>
        </View>
        <View style={styles.historyCopy}>
          <Text style={styles.historyTitle} numberOfLines={1}>
            {item.course}
          </Text>
          <Text style={styles.historyMeta} numberOfLines={1}>
            {item.timeLabel} · {item.location}
          </Text>
        </View>
        <View style={styles.presentBadge}>
          <PulsingView style={styles.presentDot} maxScale={1.35} duration={1400} minOpacity={0.55} />
          <Text style={styles.presentText}>{item.status}</Text>
        </View>
      </View>
    </AnimatedEntrance>
  );
});

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    historyRow: {
      height: HISTORY_ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    historyDate: { width: 42, height: 48, borderRadius: 13, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
    historyDateText: { color: colors.foreground, fontSize: 15, fontFamily: 'Inter_700Bold' },
    historyMonthText: { color: colors.mutedForeground, fontSize: 10, fontFamily: 'Inter_600SemiBold', marginTop: 1 },
    historyCopy: { flex: 1 },
    historyTitle: { color: colors.foreground, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    historyMeta: { color: colors.mutedForeground, fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
    presentBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    presentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
    presentText: { color: colors.primary, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  });
}

import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getTodayCheckIn, submitCheckIn } from '../../api/checkin';
import { dischargeStore } from '../../store/dischargeStore';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useTheme } from '../../hooks/useTheme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Question {
  question: string;
  red_flag: string;
}

export default function CheckInScreen() {
  const navigation = useNavigation<Nav>();
  const { discharge } = dischargeStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [dischargeId, setDischargeId] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const C = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    getTodayCheckIn().then((res) => {
      if (res.data.completed) {
        navigation.goBack();
        return;
      }
      setQuestions(res.data.questions ?? []);
      setDischargeId(res.data.discharge_id ?? '');
      setLoading(false);
    });
  }, []);

  async function answer(value: boolean) {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
      return;
    }

    setSubmitting(true);
    const responses = questions.map((q, i) => ({
      question: q.question,
      answer: newAnswers[i] ?? false,
    }));

    const res = await submitCheckIn(dischargeId, responses);

    if (res.data.red_flag_triggered) {
      const triggeredFlags = questions
        .filter((_, i) => newAnswers[i])
        .map((q) => q.red_flag);

      navigation.replace('RedFlagAlert', {
        triggeredFlags,
        providerPhone: discharge?.provider_phone ?? undefined,
      });
    } else {
      navigation.goBack();
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={C.accent} />
      </SafeAreaView>
    );
  }

  const current = questions[currentIndex];
  const progress = (currentIndex / questions.length) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.step}>
          Question {currentIndex + 1} of {questions.length}
        </Text>
      </View>

      <View style={styles.questionCard}>
        <Text style={styles.qLabel}>Symptom check</Text>
        <Text style={styles.question}>{current.question}</Text>

        <View style={styles.answers}>
          <TouchableOpacity
            style={[styles.answerBtn, styles.answerYes]}
            onPress={() => answer(true)}
            disabled={submitting}
          >
            <Text style={[styles.answerText, styles.answerYesText]}>Yes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.answerBtn, styles.answerNo]}
            onPress={() => answer(false)}
            disabled={submitting}
          >
            <Text style={[styles.answerText, styles.answerNoText]}>No</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.disclaimer}>
        This check-in is based on the warning signs from your discharge instructions. It is not a
        medical evaluation.
      </Text>
    </SafeAreaView>
  );
}

function makeStyles(C: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    center: { alignItems: 'center', justifyContent: 'center' },
    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0, marginBottom: 16 },
    back: { color: C.accent, fontSize: 15, paddingVertical: 8, marginBottom: 12 },
    progressBar: { height: 4, backgroundColor: C.trackBg, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: C.accent, borderRadius: 2 },
    step: { color: C.textMuted, fontSize: 12, marginTop: 8 },
    questionCard: {
      backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border,
      borderRadius: 20, padding: 24, flex: 1,
      marginHorizontal: 20,
    },
    qLabel: { color: C.accent, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
    question: { color: C.textPrimary, fontSize: 20, fontWeight: '700', lineHeight: 28, letterSpacing: -0.3, flex: 1 },
    answers: { gap: 10, marginTop: 24 },
    answerBtn: { padding: 16, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
    answerYes: { backgroundColor: C.dangerSurface, borderColor: C.dangerBorder },
    answerNo: { backgroundColor: C.successSurface, borderColor: C.successBorder },
    answerText: { fontSize: 15, fontWeight: '700' },
    answerYesText: { color: C.danger },
    answerNoText: { color: C.success },
    disclaimer: { color: C.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 20, marginHorizontal: 20, marginBottom: 12 },
  });
}

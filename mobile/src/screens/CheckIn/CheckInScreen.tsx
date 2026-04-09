import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getTodayCheckIn, submitCheckIn } from '../../api/checkin';
import { dischargeStore } from '../../store/dischargeStore';
import { RootStackParamList } from '../../navigation/AppNavigator';

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

    // All answered — submit
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
        <ActivityIndicator color="#4f7eff" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#13131a', padding: 20 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { marginBottom: 24 },
  back: { color: '#4f7eff', fontSize: 13, marginBottom: 12 },
  progressBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4f7eff', borderRadius: 2 },
  step: { color: '#555', fontSize: 12, marginTop: 8 },
  questionCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20, padding: 24, flex: 1,
  },
  qLabel: { color: '#4f7eff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  question: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 28, letterSpacing: -0.3, flex: 1 },
  answers: { gap: 10, marginTop: 24 },
  answerBtn: {
    padding: 16, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  answerYes: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  answerNo: { backgroundColor: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.3)' },
  answerText: { fontSize: 15, fontWeight: '700' },
  answerYesText: { color: '#ef4444' },
  answerNoText: { color: '#34d399' },
  disclaimer: { color: '#444', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 20 },
});

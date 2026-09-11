import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/number/major_system.dart';
import 'package:dingn/themes.dart';
import 'package:dingn/widgets/hyperlink.dart';
import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) => MainScreen(
        name: '/',
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 40, 24, 32),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('A LITTLE PRACTICE. A MORE VIVID MEMORY.',
                style: TextStyle(
                    fontSize: 11,
                    letterSpacing: 2,
                    fontWeight: FontWeight.bold,
                    color: mutedColor)),
            const SizedBox(height: 16),
            const Text('Make room for\nremarkable recall.',
                style: TextStyle(
                    fontSize: 44,
                    height: 1.12,
                    letterSpacing: -1.8,
                    fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            const Text(
                'Turn numbers, words, and playing cards into things you remember.\nChoose a practice to get started.',
                style: TextStyle(color: mutedColor, height: 1.7, fontSize: 15)),
            const SizedBox(height: 32),
            LayoutBuilder(builder: (context, constraints) {
              final width = constraints.maxWidth >= 720
                  ? (constraints.maxWidth - 32) / 3
                  : constraints.maxWidth;
              return Wrap(spacing: 16, runSpacing: 16, children: [
                _PracticeCard(
                    width: width,
                    title: 'Numbers',
                    subtitle: 'Give every number a picture.',
                    route: '/number',
                    kind: 0,
                    color: const Color(0xFFE7ECDD)),
                _PracticeCard(
                    width: width,
                    title: 'Words',
                    subtitle: 'Build connections that stick.',
                    route: '/word',
                    kind: 1,
                    color: const Color(0xFFF4E5DC)),
                _PracticeCard(
                    width: width,
                    title: 'Playing cards',
                    subtitle: 'Make every card memorable.',
                    route: '/card',
                    kind: 2,
                    color: const Color(0xFFE6E6F2)),
              ]);
            }),
            const SizedBox(height: 40),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: borderColor)),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('A simple trick for a lasting memory',
                        style: TextStyle(
                            fontSize: 23,
                            fontWeight: FontWeight.bold,
                            letterSpacing: -.6)),
                    const SizedBox(height: 10),
                    const Text(
                        'The Major System turns numbers into consonant sounds. Add vowels to make words, then picture them. An image is easier to recall than a string of digits.',
                        style: TextStyle(
                            color: mutedColor, height: 1.65, fontSize: 14)),
                    const SizedBox(height: 22),
                    const Text('YOUR NUMBER–SOUND GUIDE',
                        style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.5,
                            color: mutedColor)),
                    const SizedBox(height: 14),
                    LayoutBuilder(builder: (context, constraints) {
                      final columns = constraints.maxWidth >= 700
                          ? 10
                          : constraints.maxWidth >= 400
                              ? 5
                              : 2;
                      return Wrap(spacing: 8, runSpacing: 8, children: [
                        for (var i = 0; i < majorSystemDigits.length; i++)
                          Container(
                            width: (constraints.maxWidth - (columns - 1) * 8) /
                                columns,
                            padding: const EdgeInsets.symmetric(
                                vertical: 14, horizontal: 4),
                            decoration: BoxDecoration(
                                color: canvasColor,
                                borderRadius: BorderRadius.circular(10)),
                            child: Column(children: [
                              Text('$i',
                                  style: const TextStyle(
                                      fontSize: 22,
                                      fontWeight: FontWeight.bold,
                                      color: accentColor)),
                              const SizedBox(height: 6),
                              Text(
                                  majorSystemDigits[i]
                                      .split(' - ')[1]
                                      .replaceAll('/', ''),
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                      fontSize: 11, color: mutedColor)),
                            ]),
                          ),
                      ]);
                    }),
                    const SizedBox(height: 20),
                    const Text('Try it:  2 → n  +  3 → m  →  name',
                        style: TextStyle(fontSize: 13, color: mutedColor)),
                  ]),
            ),
            const SizedBox(height: 24),
            const Center(
                child: Hyperlink(
                    text: 'Have an idea? We’d love to hear it.',
                    url:
                        'mailto:support@dingn.com?subject=Issues or Suggestions&body=')),
          ]),
        ),
      );
}

class _PracticeCard extends StatelessWidget {
  const _PracticeCard(
      {required this.width,
      required this.title,
      required this.subtitle,
      required this.route,
      required this.kind,
      required this.color});
  final double width;
  final String title, subtitle, route;
  final int kind;
  final Color color;
  @override
  Widget build(BuildContext context) => SizedBox(
        width: width,
        child: Material(
          color: Colors.white,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: borderColor)),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => Navigator.of(context).pushNamed(route),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Ink(
                  height: 158,
                  color: color,
                  child: Center(
                      child:
                          ExcludeSemantics(child: _PracticeArt(kind: kind)))),
              Padding(
                  padding: const EdgeInsets.all(22),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Expanded(
                              child: Text(title,
                                  style: const TextStyle(
                                      fontSize: 22,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: -.5))),
                          const Icon(Icons.arrow_outward,
                              size: 20, color: fadedBlackColor)
                        ]),
                        const SizedBox(height: 8),
                        Text(subtitle,
                            style: const TextStyle(
                                fontSize: 13, color: mutedColor)),
                        const SizedBox(height: 20),
                        const Text('Start practicing',
                            style: TextStyle(
                                fontSize: 12,
                                color: accentColor,
                                fontWeight: FontWeight.bold)),
                      ])),
            ]),
          ),
        ),
      );
}

class _PracticeArt extends StatelessWidget {
  const _PracticeArt({required this.kind});
  final int kind;
  Widget tile(String label, double angle, Color ink) => Transform.rotate(
      angle: angle,
      child: Container(
        width: 66,
        height: 86,
        alignment: Alignment.center,
        decoration: BoxDecoration(
            color: const Color(0xFFFFFEFA),
            borderRadius: BorderRadius.circular(12),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x16000000),
                  blurRadius: 12,
                  offset: Offset(0, 7))
            ]),
        child: Text(label,
            style: TextStyle(
                fontSize: 38, fontWeight: FontWeight.bold, color: ink)),
      ));
  @override
  Widget build(BuildContext context) {
    final labels = kind == 0
        ? ['2', '7']
        : kind == 1
            ? ['a', 'b']
            : ['♠', '♥'];
    return SizedBox(
        width: 185,
        height: 126,
        child: Stack(alignment: Alignment.center, children: [
          Positioned(
              left: 23,
              top: 14,
              child: tile(
                  labels[0], -.18, kind == 2 ? fadedBlackColor : accentColor)),
          Positioned(
              right: 24,
              top: 26,
              child: tile(labels[1], .15,
                  kind == 2 ? const Color(0xFFB85450) : fadedBlackColor)),
          const Positioned(
              right: 4,
              top: 8,
              child:
                  Icon(Icons.auto_awesome, size: 19, color: Color(0x88727461))),
        ]));
  }
}

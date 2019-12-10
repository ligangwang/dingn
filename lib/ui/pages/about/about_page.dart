import 'package:animated_text_kit/animated_text_kit.dart';
import 'package:dingn/ui/widgets/common/hyperlink.dart';
import 'package:flutter/material.dart';

class AboutPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Text(
                  'dingn  ',
                  style: Theme.of(context).textTheme.display1.copyWith(
                        color: Colors.black,
                        fontSize: 36,
                      ),
                ),
                RotateAnimatedTextKit(
                    onTap: () {},
                    text: const [
                      'mind',
                      'mnemonic',
                      'major system',
                      'improvement',
                      'knowledge',
                      'learning',
                      'memory',
                      'high performance'
                    ],
                    textStyle: const TextStyle(
                        fontSize: 40,
                        // color: AppTheme.primaryColor,
                        fontFamily: 'DMSerifDisplay'),
                    textAlign: TextAlign.start,
                    alignment:
                        AlignmentDirectional.topStart // or Alignment.topLeft
                    ),
              ],
            ),
            const SizedBox(height: 16),
            _text('Welcome to dingn community, dedicated to mind and learning improvement.'),
            _text('\n'),
            _text('\n'),
            _text('About Major System'),
            _text('\n'),
            _text("The major system (also called the phonetic number system, phonetic mnemonic system, or Herigone's mnemonic system) is a mnemonic technique used to aid in memorizing numbers."),
            _text('The system works by converting numbers into consonant sounds, then into words by adding vowels. The system works on the principle that images can be remembered more easily than numbers.'),
            _text('\n'),
            const Hyperlink(text: 'See more here', url: 'https://en.wikipedia.org/wiki/Mnemonic_major_system'),
          ],
        ),
      ),
    );
  }
}

Widget _text(String text) {
  return Container(
    child: Text(
      text,
      // style: const TextStyle(fontSize: 18, color: AppTheme.fadedBlack),
    ),
  );
}


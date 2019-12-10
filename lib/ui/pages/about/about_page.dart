import 'package:dingn/ui/pages/number/number_detail_page.dart';
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
                  'About dingn',
                  style: Theme.of(context).textTheme.display1.copyWith(
                        color: Colors.black,
                        fontSize: 36,
                      ),
                ),

              ],
            ),
            const SizedBox(height: 16),
            _text('Welcome to dingn community, dedicated to mind and learning improvement.'),
            _text('\n'),
            _text('About Major System'),
            _text('\n'),
            _text("The major system (also called the phonetic number system, phonetic mnemonic system, or Herigone's mnemonic system) is a mnemonic technique used to aid in memorizing numbers."),
            _text('The system works by converting numbers into consonant sounds, then into words by adding vowels. The system works on the principle that images can be remembered more easily than numbers.'),
            _text('\n'),
            _text('The Number/Consonant Sound Mapping'),
            for (var digit_desc in major_system_digits)
              _text(digit_desc),
            _text('\n'),
            const Hyperlink(text: 'Learn more about major system', url: 'https://en.wikipedia.org/wiki/Mnemonic_major_system'),
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


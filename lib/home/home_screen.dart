import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/number/major_system.dart';
import 'package:dingn/themes.dart';
import 'package:dingn/widgets/hyperlink.dart';
import 'package:flutter/material.dart';

class HomeScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MainScreen(
      name: '/',
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              const SizedBox(height: 16),
              _text(
                  'Remember numbers/playing cards/list of items using Major System'),
              _text('\n'),
              _text(
                  "The major system (also called the phonetic number system, phonetic mnemonic system, or Herigone's mnemonic system) is a mnemonic technique used to aid in memorizing numbers."),
              _text('\n'),
              _text(
                  'The system works by converting numbers into consonant sounds, then into words by adding vowels. The system works on the principle that images can be remembered more easily than numbers.'),
              _text('\n'),
              _text('The Number/Consonant Sound Mapping'),
              for (var digitDesc in majorSystemDigits) _text(digitDesc),
              _text('\n'),
              const Hyperlink(
                  text:
                      'Please send any issues and suggestions for improvements',
                  url:
                      'mailto:support@dingn.com?subject=Issues or Suggestions&body='),
            ],
          ),
        ),
      ),
    );
  }
}

Widget _text(String text, {double size = 15}) {
  return Text(
    text,
    style: TextStyle(fontSize: size, color: fadedBlackColor),
    softWrap: true,
  );
}

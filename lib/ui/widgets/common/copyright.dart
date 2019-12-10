
import 'package:flutter/material.dart';

class CopyrightTailer extends StatelessWidget {
  const CopyrightTailer({
    Key key,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 800),
          child: const Padding(
            padding: EdgeInsets.all(8.0),
            child: Text(
                '© dingn 2019'),
          ),
        ),
      ),
    );
  }
}
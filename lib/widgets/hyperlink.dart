import 'package:dingn/utils/url_util.dart';
import 'package:flutter/material.dart';

@immutable
class Hyperlink extends StatelessWidget {
  const Hyperlink({this.text, this.url});
  final String url;
  final String text;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      child: Text(
        text,
        style: const TextStyle(decoration: TextDecoration.underline),
      ),
      onTap: ()=> UrlUtil.open(url),
    );
  }
}
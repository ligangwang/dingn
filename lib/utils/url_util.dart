import 'package:universal_html/html.dart' as html;

void open(String url, {required String name}) {
  html.window.open(url, name);
}

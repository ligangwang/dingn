import 'dart:convert';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;
import 'package:webfeed/webfeed.dart';

enum UriContentFormat { Json, Rss, Atom }

@immutable
class UriApi {
  const UriApi({@required this.uri, @required this.format});

  final String uri;
  final UriContentFormat format;

  Future<dynamic> fetchData() async {
    final http.Response response = await http.get(
      Uri.encodeFull(uri),
    );
    if (response.statusCode == 200) {
      if(format==UriContentFormat.Json)
        return json.decode(response.body);
      else if(format==UriContentFormat.Rss)
        return RssFeed.parse(response.body);
      else if(format==UriContentFormat.Atom)
        return AtomFeed.parse(response.body);
    } else {
      throw Exception('Error fetching posts: ${response.statusCode} ${response.statusCode}');
    }
  }
}

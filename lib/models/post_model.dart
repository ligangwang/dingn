import 'package:webfeed/webfeed.dart';

class Post {
  Post(this.items);

  factory Post.fromJson(Map<String, dynamic> json) {
    final listPages = json['pages'] as List;
    final List<PostData> posts =
        listPages.map((i) => PostData.fromJson(i)).toList();

    return Post(posts);
  }

  factory Post.fromAtom(AtomFeed atom){
    final List<PostData> posts = 
      atom.items.map((item) => PostData.fromAtom(item)).toList();
    return Post(posts);
  }

  final List<PostData> items;

  Post copyWith({
    List<PostData> items,
  }) {
    return Post(items ?? this.items);
  }
}

class PostData {
  PostData(this.summary, this.title, this.published, this.uri, this.thumbnail);

  PostData.fromJson(Map<String, dynamic> json)
      : summary = json['description'],
        title = json['title'],
        published = null,
        uri = json['uri'],
        thumbnail = json['thumbnail'];

  PostData.fromAtom(AtomItem atom)
      : summary = atom.summary,
        title = atom.title,
        published = atom.published,
        uri = atom.id,
        thumbnail = null;

  final String summary;
  final String title;
  final String published;
  final String uri;
  final String thumbnail;
}

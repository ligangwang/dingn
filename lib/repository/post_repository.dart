import 'package:dingn/services/uri_api.dart';
import 'package:meta/meta.dart';
import 'package:dingn/models/post_model.dart';
import 'package:webfeed/webfeed.dart';

@immutable
class PostRepository {
  const PostRepository({@required UriApi postApi})
      : _postApi = postApi;

  final UriApi _postApi;

  Future<Post> getPost() async {
    final data = await _postApi.fetchData();
    if (data is AtomFeed)
      return Post.fromAtom(data);
    else
      return Post.fromJson(data);
  }
}

import 'package:dingn/utils/url_util.dart';
import 'package:flutter/material.dart';
import 'package:dingn/models/post_model.dart';

class PostCard extends StatelessWidget {
  const PostCard({Key key, this.post}) : super(key: key);
  final PostData post;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        UrlUtil.open(post.uri);
      },
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Card(
          child: Container(
            child: Column(
              children: <Widget>[
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(8.0),
                    child: Text(
                    post?.summary,
                    overflow: TextOverflow.ellipsis,
                  ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Text(
                    post?.title,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.headline,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Container(
                    constraints:
                        const BoxConstraints(minHeight: 30, maxHeight: 60),
                    child: Text(
                      post?.published,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

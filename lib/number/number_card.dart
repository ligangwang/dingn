import 'package:dingn/number/number.dart';
import 'package:dingn/themes.dart';
import 'package:flutter/material.dart';

class NumberCard extends StatelessWidget {
  const NumberCard({Key key, this.number, this.onFavorite}) : super(key: key);
  final Number number;
  final Future<void> Function(String) onFavorite;

  @override
  Widget build(BuildContext context) {
    //if (index!=null)
    //  print('build number: $index, ${numberModel.activeItem.number}, ${numberModel.activeItem.favoriteWord}');
    return Container(
          //constraints: const BoxConstraints(minWidth: 120, minHeight: 80, maxWidth: 600, maxHeight: 400),
          child: Card(
            //margin: const EdgeInsets.all(20),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(15.0)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                ListTile(
                  leading: const Icon(Icons.bookmark, size: 50, color: AppTheme.accentColor,),
                  title: Text(number.number, style: const TextStyle(color: AppTheme.accentColor, fontWeight: FontWeight.bold)),
                  //subtitle: Text('${word.lang}: ${word.ipa}')
                ),
                const Divider(height: 10, thickness:1, indent: 20, endIndent: 20,),
                Padding(
                  padding: const EdgeInsets.all(20),  
                  child: Row(
                  mainAxisAlignment: MainAxisAlignment.start,
                  children: <Widget>[
                    const Text('Favorite word:', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(width: 20),
                    if (number.favoriteWord!=null)
                      Text(number.favoriteWord, style: const TextStyle(color: AppTheme.accentColor)),
                  ],
                ),
                ),
                const Divider(height: 10, thickness:1, indent: 20, endIndent: 20,),
                Expanded(
                  child:
                  Container(
                    padding: const EdgeInsets.all(10),  
                  
                    //height: 300,
                    child: ListView(
                      //spacing: 10,
                      //controller: _controller,
                      //mainAxisSize: MainAxisSize.min,
                      //crossAxisAlignment: CrossAxisAlignment.start,
                      //shrinkWrap: true,
                      children: <Widget>[
                        for (var item in number.words)
                          WordItem(item, item==number.favoriteWord, onFavorite)
                      ]
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
  }
}

class WordItem extends StatelessWidget{
  const WordItem(this.word, this.isFavorite, this.onFavorite);
  final String word;
  final bool isFavorite;
  final Future<void> Function(String) onFavorite;
  @override
  Widget build(BuildContext context){
    return ListTile(
      title: Text(word), 
      leading: IconButton(
        icon: Icon(Icons.favorite),
        color: isFavorite ? Colors.redAccent: Colors.grey,
        onPressed: (){
          if (!isFavorite){
            onFavorite(word);
          }
        },
      ),
      trailing: null,
      //subtitle: Hyperlink(text:'https://en.wiktionary.org/wiki/${sortedWords[index]}', url:'https://en.wiktionary.org/wiki/${sortedWords[index]}')
    );
  }
}
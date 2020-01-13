import 'package:dingn/account/account.dart';
import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/themes.dart';
import 'package:flutter/material.dart';
import 'package:dingn/account/account_model.dart';
import 'package:provider/provider.dart';

class AccountScreen extends StatefulWidget{
  @override
  _AccountScreenState createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen>{
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final accountModel = Provider.of<AccountModel>(context);
    accountModel.accountChanges.listen((account) {
      if (account == null) {
        Navigator.of(context)
            .pushNamedAndRemoveUntil('/', (Route<dynamic> route) => false);
      }
    });
    if (accountModel.account == null) 
      return Container();
    _controller.text = accountModel.account.userName;
    return MainScreen(
      name: '/account',
      child: Scaffold(
        body: Column(
          children: <Widget>[
            Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
              Container(
                  padding: const EdgeInsets.all(8),
                  height: 100.0,
                  width: 100.0,
                  child: CircleAvatar(
                      backgroundColor: AppTheme.accentColor,
                      radius: 50.0,
                      backgroundImage: accountModel.account.photoURL == null
                          ? null
                          : NetworkImage(accountModel.account.photoURL),
                      child: accountModel.account.photoURL == null
                          ? Text(accountModel.account.initials)
                          : null)),
            ]),
            Container(
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.all(8),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: <Widget>[
                    Container(
                      alignment: Alignment.bottomCenter,
                      padding: const EdgeInsets.only(right: 30),
                      child: const Text(
                        'Display Name:',
                        style: TextStyle(
                            fontSize: AppTheme.fontSizeMedium,
                            fontWeight: FontWeight.bold),
                      ),
                    ),
                    Container(
                      alignment: Alignment.centerLeft,
                      constraints:
                          const BoxConstraints(minWidth: 100, maxWidth: 200),
                      child: TextField(
                        controller: _controller,
                        decoration: InputDecoration(
                          hintText: 'Display Name',
                          errorText: accountModel.errorMessage,
                        ),
                        readOnly: !accountModel.editMode,
                        autofocus: accountModel.editMode,
                        onSubmitted: (newValue) {
                          newValue = newValue.trim();
                        },
                      )
                    ),
                    Container(
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.only(left: 8),
                      child: OutlineButton(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                          side: const BorderSide(width: 2)),
                        child: Text(accountModel.editMode? 'save': 'edit', style: const TextStyle(color: AppTheme.accentColor)),
                        onPressed: (){
                          if (!accountModel.editMode)
                            accountModel.setEditMode(true);
                          else{
                            accountModel.changeUserName(_controller.text);
                            accountModel.setEditMode(false);
                          }
                        },
                      ),
                    ),
                  ],
                )
            ),
            //choose
            Container(
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.all(8),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: <Widget>[
                    Container(
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.only(right: 8),
                      child: const Text(
                        'Show Card Sides:',
                        style: TextStyle(
                            fontSize: AppTheme.fontSizeMedium,
                            fontWeight: FontWeight.bold),
                      ),
                    ),
                    Container(
                      constraints:
                          const BoxConstraints(maxHeight: 100, maxWidth: 200),
                      child: RadioListTile(
                        title: const Text('One Side - Training'),
                        groupValue: accountModel.cardSide,
                        value: CardSide.OneSide,
                        onChanged: (value)=>accountModel.setCardSide(value),
                      )
                    ),
                    Container(
                      constraints:
                          const BoxConstraints(maxHeight: 100, maxWidth: 200),
                      child: RadioListTile(
                        title: const Text('Two Sides - Recall'),
                        groupValue: accountModel.cardSide,
                        value: CardSide.TwoSides,
                        onChanged: (value)=>accountModel.setCardSide(value),
                      )
                    ),
                  ],
                )
            ),
            Container(
              padding: const EdgeInsets.all(8),
              child: FlatButton(
                child: Column(children: const <Widget>[
                  Icon(Icons.exit_to_app, color: AppTheme.accentColor),
                  Text(
                    'Sign out',
                    style: TextStyle(
                        color: AppTheme.accentColor,
                        fontSize: AppTheme.fontSizeIconButtonText),
                  )
                ]),
                onPressed: () => accountModel.signOut()
              )
            )
          ],
        ),
      ),
    );
  }
}
